package store

import (
	"context"
	"os"
	"testing"
	"time"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/leads"
)

// Les mêmes scénarios s'exécutent sur la version mémoire et sur Postgres :
// c'est la garantie que les tests HTTP (qui tournent sur la mémoire) disent
// quelque chose de vrai sur la production.

func TestMemoryStore(t *testing.T) {
	runStoreScenarios(t, NewMemory())
}

func TestPostgresStore(t *testing.T) {
	url := os.Getenv("PROSPECTION_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("PROSPECTION_TEST_DATABASE_URL absent : test Postgres ignoré")
	}
	ctx := context.Background()
	pg, err := NewPostgres(ctx, url)
	if err != nil {
		t.Fatalf("connexion : %v", err)
	}
	defer pg.Close()
	// Base de test : on repart de zéro à chaque exécution.
	if _, err := pg.pool.Exec(ctx, `TRUNCATE leads RESTART IDENTITY`); err != nil {
		t.Fatalf("truncate : %v", err)
	}
	runStoreScenarios(t, pg)
}

func runStoreScenarios(t *testing.T, st Store) {
	t.Helper()
	ctx := context.Background()
	t0 := time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC)
	mobile, _ := leads.NormalizePhone("0661234567")
	other, _ := leads.NormalizePhone("0770000000")

	// --- création puis mise à jour de la même fiche ---
	l1, created, err := st.Upsert(ctx, leads.Ingest{Source: "g", SourceID: "p1", Name: "Alpha", Wilaya: "Alger"}, &mobile, t0)
	if err != nil || !created || l1.ID == 0 || l1.Status != leads.StatusNouveau {
		t.Fatalf("création : %v %v %+v", err, created, l1)
	}
	l1b, created, err := st.Upsert(ctx, leads.Ingest{Source: "g", SourceID: "p1", Name: "Alpha Phone", Address: "Rue X"}, nil, t0.Add(time.Hour))
	if err != nil || created || l1b.ID != l1.ID {
		t.Fatalf("mise à jour : %v %v %+v", err, created, l1b)
	}
	if l1b.Name != "Alpha Phone" || l1b.Address != "Rue X" || l1b.PhoneE164 != "+213661234567" || l1b.Wilaya != "Alger" {
		t.Errorf("les champs connus doivent rester, les nouveaux s'ajouter : %+v", l1b)
	}
	if !l1b.LastSeenAt.After(l1b.FirstSeenAt) {
		t.Error("last_seen doit avancer, first_seen rester")
	}

	// --- même numéro sous une autre fiche source : fusion ---
	l1c, created, err := st.Upsert(ctx, leads.Ingest{Source: "g", SourceID: "p1-bis", Name: "Alpha (doublon)"}, &mobile, t0)
	if err != nil || created || l1c.ID != l1.ID {
		t.Errorf("même numéro = même prospect : %v %v %+v", err, created, l1c)
	}

	// --- un second prospect, ailleurs ---
	l2, created, err := st.Upsert(ctx, leads.Ingest{Source: "g", SourceID: "p2", Name: "Beta", Wilaya: "Oran"}, &other, t0.Add(2*time.Hour))
	if err != nil || !created {
		t.Fatalf("second : %v %v", err, created)
	}
	// --- un troisième, sans numéro ---
	if _, created, err := st.Upsert(ctx, leads.Ingest{Source: "g", SourceID: "p3", Name: "Gamma", Wilaya: "Oran"}, nil, t0.Add(3*time.Hour)); err != nil || !created {
		t.Fatalf("troisième : %v %v", err, created)
	}

	// --- liste : ordre, filtres, pagination ---
	page, err := st.List(ctx, ListFilter{})
	if err != nil || page.Total != 3 || len(page.Items) != 3 {
		t.Fatalf("liste : %v %+v", err, page)
	}
	// La fusion par numéro (« Alpha (doublon) ») a adopté le nom de la fiche la
	// plus récente : le nom suit toujours la dernière fiche vue.
	if page.Items[0].Name != "Gamma" || page.Items[2].Name != "Alpha (doublon)" {
		t.Errorf("ordre attendu : plus récent d'abord, obtenu %s … %s", page.Items[0].Name, page.Items[2].Name)
	}
	if p, _ := st.List(ctx, ListFilter{Wilaya: "oran"}); p.Total != 2 {
		t.Errorf("filtre wilaya insensible à la casse : %d", p.Total)
	}
	if p, _ := st.List(ctx, ListFilter{Query: "ALPHA"}); p.Total != 1 {
		t.Errorf("recherche par nom : %d", p.Total)
	}
	if p, _ := st.List(ctx, ListFilter{Query: "0770000000"}); p.Total != 1 || p.Items[0].ID != l2.ID {
		t.Errorf("recherche par numéro : %+v", p)
	}
	if p, _ := st.List(ctx, ListFilter{Page: 2, PerPage: 2}); p.Total != 3 || len(p.Items) != 1 {
		t.Errorf("pagination : %+v", p)
	}

	// --- suivi commercial ---
	status := leads.StatusInteresse
	note := "rappeler jeudi"
	u, err := st.Update(ctx, l2.ID, Update{Status: &status, Note: &note}, t0.Add(4*time.Hour))
	if err != nil || u.Status != status || u.Note != note || u.ContactedAt == nil {
		t.Fatalf("update : %v %+v", err, u)
	}
	firstContact := *u.ContactedAt
	client := leads.StatusClient
	u, _ = st.Update(ctx, l2.ID, Update{Status: &client}, t0.Add(5*time.Hour))
	if !u.ContactedAt.Equal(firstContact) {
		t.Error("la date de premier contact ne doit pas bouger ensuite")
	}
	// Une collecte ultérieure ne touche pas au suivi.
	again, _, _ := st.Upsert(ctx, leads.Ingest{Source: "g", SourceID: "p2", Name: "Beta Mobile"}, &other, t0.Add(6*time.Hour))
	if again.Status != client || again.Note != note || again.Name != "Beta Mobile" {
		t.Errorf("collecte après suivi : %+v", again)
	}
	if _, err := st.Update(ctx, 9999, Update{Note: &note}, t0); err != ErrNotFound {
		t.Errorf("inconnu : %v", err)
	}
	if _, err := st.Get(ctx, 9999); err != ErrNotFound {
		t.Errorf("get inconnu : %v", err)
	}

	// --- stats et wilayas ---
	s, err := st.Stats(ctx)
	if err != nil || s.Total != 3 || s.ByStatus[leads.StatusClient] != 1 || s.ByStatus[leads.StatusNouveau] != 2 || s.ByWilaya["Oran"] != 2 {
		t.Errorf("stats : %v %+v", err, s)
	}
	ws, _ := st.Wilayas(ctx)
	if len(ws) != 2 || ws[0] != "Alger" || ws[1] != "Oran" {
		t.Errorf("wilayas : %v", ws)
	}
}
