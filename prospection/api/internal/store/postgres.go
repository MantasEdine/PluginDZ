package store

import (
	"context"
	"embed"
	"errors"
	"fmt"
	"io/fs"
	"sort"
	"strings"
	"time"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/leads"
)

// Les migrations voyagent dans le binaire : un seul artefact à déployer, et la
// base est mise à niveau au démarrage. Elles sont numérotées et appliquées dans
// l'ordre, une seule fois chacune.
//
//go:embed migrations/*.sql
var migrationFiles embed.FS

// Postgres est le Store de production.
type Postgres struct {
	pool *pgxpool.Pool
}

// NewPostgres ouvre le pool et applique les migrations manquantes.
func NewPostgres(ctx context.Context, databaseURL string) (*Postgres, error) {
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		return nil, fmt.Errorf("connexion Postgres : %w", err)
	}
	if err := pool.Ping(ctx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("ping Postgres : %w", err)
	}
	p := &Postgres{pool: pool}
	if err := p.migrate(ctx); err != nil {
		pool.Close()
		return nil, err
	}
	return p, nil
}

// Close libère le pool.
func (p *Postgres) Close() { p.pool.Close() }

// migrate applique, dans l'ordre des noms de fichiers, celles qui ne sont pas
// encore enregistrées dans schema_migrations.
func (p *Postgres) migrate(ctx context.Context) error {
	if _, err := p.pool.Exec(ctx, `CREATE TABLE IF NOT EXISTS schema_migrations (
		name TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now())`); err != nil {
		return fmt.Errorf("table schema_migrations : %w", err)
	}

	entries, err := fs.ReadDir(migrationFiles, "migrations")
	if err != nil {
		return err
	}
	names := make([]string, 0, len(entries))
	for _, e := range entries {
		if strings.HasSuffix(e.Name(), ".sql") {
			names = append(names, e.Name())
		}
	}
	sort.Strings(names)

	for _, name := range names {
		var done bool
		if err := p.pool.QueryRow(ctx, `SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name = $1)`, name).Scan(&done); err != nil {
			return err
		}
		if done {
			continue
		}
		sql, err := migrationFiles.ReadFile("migrations/" + name)
		if err != nil {
			return err
		}
		// Migration + enregistrement dans la même transaction : soit les deux,
		// soit aucun. Pas de base à moitié migrée.
		tx, err := p.pool.Begin(ctx)
		if err != nil {
			return err
		}
		if _, err := tx.Exec(ctx, string(sql)); err != nil {
			_ = tx.Rollback(ctx)
			return fmt.Errorf("migration %s : %w", name, err)
		}
		if _, err := tx.Exec(ctx, `INSERT INTO schema_migrations (name) VALUES ($1)`, name); err != nil {
			_ = tx.Rollback(ctx)
			return err
		}
		if err := tx.Commit(ctx); err != nil {
			return err
		}
	}
	return nil
}

// leadColumns est la liste des colonnes lues, dans l'ordre attendu par scanLead.
const leadColumns = `id, source, source_id, name, phone_e164, phone_national, is_mobile,
	address, wilaya, lat, lng, maps_url, website, rating, rating_count,
	status, note, first_seen_at, last_seen_at, contacted_at, updated_at`

// scanLead lit une ligne SELECT leadColumns. Les colonnes NULL deviennent des
// chaînes vides ou des pointeurs nuls, comme dans la version mémoire.
func scanLead(row pgx.Row) (leads.Lead, error) {
	var (
		l                                                  leads.Lead
		phoneE164, phoneNational, address, wilaya, maps, web *string
		rating                                             *float64
		ratingCount                                        *int
		status                                             string
	)
	err := row.Scan(&l.ID, &l.Source, &l.SourceID, &l.Name, &phoneE164, &phoneNational, &l.IsMobile,
		&address, &wilaya, &l.Lat, &l.Lng, &maps, &web, &rating, &ratingCount,
		&status, &l.Note, &l.FirstSeenAt, &l.LastSeenAt, &l.ContactedAt, &l.UpdatedAt)
	if err != nil {
		return l, err
	}
	l.PhoneE164, l.PhoneNational = deref(phoneE164), deref(phoneNational)
	l.Address, l.Wilaya, l.MapsURL, l.Website = deref(address), deref(wilaya), deref(maps), deref(web)
	l.Rating, l.RatingCount = rating, ratingCount
	l.Status = leads.Status(status)
	return l, nil
}

func deref(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// nullable renvoie nil pour une chaîne vide, pour écrire NULL plutôt que ''.
func nullable(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func (p *Postgres) Upsert(ctx context.Context, in leads.Ingest, phone *leads.Phone, now time.Time) (leads.Lead, bool, error) {
	tx, err := p.pool.Begin(ctx)
	if err != nil {
		return leads.Lead{}, false, err
	}
	defer func() { _ = tx.Rollback(ctx) }()

	// Retrouver la fiche existante : par source, sinon par numéro.
	var existing leads.Lead
	found := false
	l, err := scanLead(tx.QueryRow(ctx,
		`SELECT `+leadColumns+` FROM leads WHERE source = $1 AND source_id = $2 FOR UPDATE`, in.Source, in.SourceID))
	switch {
	case err == nil:
		existing, found = l, true
	case errors.Is(err, pgx.ErrNoRows) && phone != nil:
		l, err = scanLead(tx.QueryRow(ctx,
			`SELECT `+leadColumns+` FROM leads WHERE phone_e164 = $1 FOR UPDATE`, phone.E164))
		if err == nil {
			existing, found = l, true
		} else if !errors.Is(err, pgx.ErrNoRows) {
			return leads.Lead{}, false, err
		}
	case errors.Is(err, pgx.ErrNoRows):
		// aucune fiche : on créera
	default:
		return leads.Lead{}, false, err
	}

	if found {
		applyIngest(&existing, in, phone, now)
		row := tx.QueryRow(ctx, `UPDATE leads SET
			name = $2, phone_e164 = $3, phone_national = $4, is_mobile = $5, address = $6, wilaya = $7,
			lat = $8, lng = $9, maps_url = $10, website = $11, rating = $12, rating_count = $13,
			last_seen_at = $14, updated_at = $14
			WHERE id = $1 RETURNING `+leadColumns,
			existing.ID, existing.Name, nullable(existing.PhoneE164), nullable(existing.PhoneNational), existing.IsMobile,
			nullable(existing.Address), nullable(existing.Wilaya), existing.Lat, existing.Lng,
			nullable(existing.MapsURL), nullable(existing.Website), existing.Rating, existing.RatingCount, now)
		updated, err := scanLead(row)
		if err != nil {
			return leads.Lead{}, false, err
		}
		return updated, false, tx.Commit(ctx)
	}

	fresh := leads.Lead{Source: in.Source, SourceID: in.SourceID, Status: leads.StatusNouveau, FirstSeenAt: now}
	applyIngest(&fresh, in, phone, now)
	row := tx.QueryRow(ctx, `INSERT INTO leads
		(source, source_id, name, phone_e164, phone_national, is_mobile, address, wilaya, lat, lng,
		 maps_url, website, rating, rating_count, status, first_seen_at, last_seen_at, updated_at)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$16,$16)
		RETURNING `+leadColumns,
		fresh.Source, fresh.SourceID, fresh.Name, nullable(fresh.PhoneE164), nullable(fresh.PhoneNational), fresh.IsMobile,
		nullable(fresh.Address), nullable(fresh.Wilaya), fresh.Lat, fresh.Lng, nullable(fresh.MapsURL), nullable(fresh.Website),
		fresh.Rating, fresh.RatingCount, string(fresh.Status), now)
	created, err := scanLead(row)
	if err != nil {
		return leads.Lead{}, false, err
	}
	return created, true, tx.Commit(ctx)
}

func (p *Postgres) List(ctx context.Context, f ListFilter) (Page, error) {
	f = normalizeFilter(f)
	where, args := []string{"TRUE"}, []any{}
	add := func(cond string, v any) {
		args = append(args, v)
		where = append(where, fmt.Sprintf(cond, len(args)))
	}
	if f.Wilaya != "" {
		add("lower(wilaya) = lower($%d)", f.Wilaya)
	}
	if f.Status != "" {
		add("status = $%d", string(f.Status))
	}
	if f.Query != "" {
		add("(lower(name) LIKE $%d OR lower(coalesce(address,'')) LIKE $%[1]d OR coalesce(phone_national,'') LIKE $%[1]d OR coalesce(phone_e164,'') LIKE $%[1]d)",
			"%"+f.Query+"%")
	}
	clause := strings.Join(where, " AND ")

	var total int
	if err := p.pool.QueryRow(ctx, `SELECT count(*) FROM leads WHERE `+clause, args...).Scan(&total); err != nil {
		return Page{}, err
	}

	args = append(args, f.PerPage, (f.Page-1)*f.PerPage)
	rows, err := p.pool.Query(ctx, `SELECT `+leadColumns+` FROM leads WHERE `+clause+
		fmt.Sprintf(` ORDER BY first_seen_at DESC, id DESC LIMIT $%d OFFSET $%d`, len(args)-1, len(args)), args...)
	if err != nil {
		return Page{}, err
	}
	defer rows.Close()

	items := []leads.Lead{}
	for rows.Next() {
		l, err := scanLead(rows)
		if err != nil {
			return Page{}, err
		}
		items = append(items, l)
	}
	return Page{Items: items, Total: total, Page: f.Page, PerPage: f.PerPage}, rows.Err()
}

func (p *Postgres) Get(ctx context.Context, id int64) (leads.Lead, error) {
	l, err := scanLead(p.pool.QueryRow(ctx, `SELECT `+leadColumns+` FROM leads WHERE id = $1`, id))
	if errors.Is(err, pgx.ErrNoRows) {
		return leads.Lead{}, ErrNotFound
	}
	return l, err
}

func (p *Postgres) Update(ctx context.Context, id int64, u Update, now time.Time) (leads.Lead, error) {
	// contacted_at : posé à la première sortie de « nouveau », jamais réécrit.
	row := p.pool.QueryRow(ctx, `UPDATE leads SET
		status = coalesce($2, status),
		note   = coalesce($3, note),
		contacted_at = CASE
			WHEN $2 IS NOT NULL AND $2 <> 'nouveau' AND contacted_at IS NULL THEN $4
			ELSE contacted_at END,
		updated_at = $4
		WHERE id = $1 RETURNING `+leadColumns,
		id, statusArg(u.Status), u.Note, now)
	l, err := scanLead(row)
	if errors.Is(err, pgx.ErrNoRows) {
		return leads.Lead{}, ErrNotFound
	}
	return l, err
}

func statusArg(s *leads.Status) *string {
	if s == nil {
		return nil
	}
	v := string(*s)
	return &v
}

func (p *Postgres) Stats(ctx context.Context) (Stats, error) {
	s := Stats{ByStatus: map[leads.Status]int{}, ByWilaya: map[string]int{}}

	rows, err := p.pool.Query(ctx, `SELECT status, count(*) FROM leads GROUP BY status`)
	if err != nil {
		return s, err
	}
	for rows.Next() {
		var status string
		var n int
		if err := rows.Scan(&status, &n); err != nil {
			rows.Close()
			return s, err
		}
		s.ByStatus[leads.Status(status)] = n
		s.Total += n
	}
	rows.Close()

	rows, err = p.pool.Query(ctx, `SELECT wilaya, count(*) FROM leads WHERE wilaya IS NOT NULL GROUP BY wilaya`)
	if err != nil {
		return s, err
	}
	defer rows.Close()
	for rows.Next() {
		var w string
		var n int
		if err := rows.Scan(&w, &n); err != nil {
			return s, err
		}
		s.ByWilaya[w] = n
	}
	return s, rows.Err()
}

func (p *Postgres) Wilayas(ctx context.Context) ([]string, error) {
	rows, err := p.pool.Query(ctx, `SELECT DISTINCT wilaya FROM leads WHERE wilaya IS NOT NULL ORDER BY wilaya`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []string{}
	for rows.Next() {
		var w string
		if err := rows.Scan(&w); err != nil {
			return nil, err
		}
		out = append(out, w)
	}
	return out, rows.Err()
}
