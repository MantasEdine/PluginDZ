// Package store persiste les prospects.
//
// Le contrat (Store) est écrit d'abord, avec deux implémentations : Postgres
// pour de vrai, et une version en mémoire pour les tests — ils exercent alors
// toute la logique HTTP en quelques millisecondes, sans base à démarrer.
package store

import (
	"context"
	"errors"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/leads"
)

// ErrNotFound : l'identifiant ne désigne aucun prospect.
var ErrNotFound = errors.New("prospect introuvable")

// ListFilter décrit ce que le back-office demande à voir.
type ListFilter struct {
	Wilaya  string
	Status  leads.Status
	Query   string // sous-chaîne, insensible à la casse, sur nom / adresse / téléphone
	Page    int    // à partir de 1
	PerPage int
}

// Page est une tranche de résultats avec le total, pour la pagination.
type Page struct {
	Items   []leads.Lead `json:"items"`
	Total   int          `json:"total"`
	Page    int          `json:"page"`
	PerPage int          `json:"perPage"`
}

// Stats : la vue d'ensemble affichée en tête de page.
type Stats struct {
	Total    int                  `json:"total"`
	ByStatus map[leads.Status]int `json:"byStatus"`
	ByWilaya map[string]int       `json:"byWilaya"`
}

// Update : ce que le back-office peut changer sur un prospect. Un pointeur nul
// signifie « ne pas toucher ».
type Update struct {
	Status *leads.Status
	Note   *string
}

// Store est le contrat de persistance.
type Store interface {
	// Upsert crée le prospect ou met à jour celui qui existe déjà (même fiche
	// source, ou même numéro). Le suivi commercial (statut, note, date de
	// contact) n'est jamais écrasé par une nouvelle collecte.
	Upsert(ctx context.Context, in leads.Ingest, phone *leads.Phone, now time.Time) (lead leads.Lead, created bool, err error)
	List(ctx context.Context, f ListFilter) (Page, error)
	Get(ctx context.Context, id int64) (leads.Lead, error)
	Update(ctx context.Context, id int64, u Update, now time.Time) (leads.Lead, error)
	Stats(ctx context.Context) (Stats, error)
	// Wilayas : celles où l'on a au moins un prospect, pour le filtre.
	Wilayas(ctx context.Context) ([]string, error)
}

// normalizeFilter borne la pagination à des valeurs raisonnables.
func normalizeFilter(f ListFilter) ListFilter {
	if f.Page < 1 {
		f.Page = 1
	}
	if f.PerPage < 1 || f.PerPage > 200 {
		f.PerPage = 50
	}
	f.Query = strings.ToLower(strings.TrimSpace(f.Query))
	f.Wilaya = strings.TrimSpace(f.Wilaya)
	return f
}

// applyIngest recopie dans un prospect existant ce qu'une collecte a de neuf,
// sans toucher au suivi commercial. Un champ vide côté collecte ne vide jamais
// une valeur déjà connue : une fiche Google peut perdre son site web un jour et
// le retrouver le lendemain.
func applyIngest(l *leads.Lead, in leads.Ingest, phone *leads.Phone, now time.Time) {
	if in.Name != "" {
		l.Name = in.Name
	}
	if phone != nil {
		l.PhoneE164, l.PhoneNational, l.IsMobile = phone.E164, phone.National, phone.Mobile
	}
	if in.Address != "" {
		l.Address = in.Address
	}
	if in.Wilaya != "" {
		l.Wilaya = in.Wilaya
	}
	if in.Lat != nil && in.Lng != nil {
		l.Lat, l.Lng = in.Lat, in.Lng
	}
	if in.MapsURL != "" {
		l.MapsURL = in.MapsURL
	}
	if in.Website != "" {
		l.Website = in.Website
	}
	if in.Rating != nil {
		l.Rating = in.Rating
	}
	if in.RatingCount != nil {
		l.RatingCount = in.RatingCount
	}
	l.LastSeenAt = now
	l.UpdatedAt = now
}

// ------------------------------------------------------------------ mémoire

// Memory est un Store en mémoire, pour les tests. Il applique exactement les
// mêmes règles que Postgres — c'est le point.
type Memory struct {
	mu     sync.Mutex
	nextID int64
	items  []leads.Lead
}

// NewMemory crée un Store vide.
func NewMemory() *Memory { return &Memory{nextID: 1} }

func (m *Memory) Upsert(_ context.Context, in leads.Ingest, phone *leads.Phone, now time.Time) (leads.Lead, bool, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	// 1. Même fiche source ?
	for i := range m.items {
		if m.items[i].Source == in.Source && m.items[i].SourceID == in.SourceID {
			applyIngest(&m.items[i], in, phone, now)
			return m.items[i], false, nil
		}
	}
	// 2. Même numéro sous une autre fiche ?
	if phone != nil {
		for i := range m.items {
			if m.items[i].PhoneE164 == phone.E164 {
				applyIngest(&m.items[i], in, phone, now)
				return m.items[i], false, nil
			}
		}
	}
	// 3. Nouveau.
	l := leads.Lead{
		ID: m.nextID, Source: in.Source, SourceID: in.SourceID,
		Status: leads.StatusNouveau, FirstSeenAt: now,
	}
	m.nextID++
	applyIngest(&l, in, phone, now)
	m.items = append(m.items, l)
	return l, true, nil
}

func (m *Memory) List(_ context.Context, f ListFilter) (Page, error) {
	f = normalizeFilter(f)
	m.mu.Lock()
	defer m.mu.Unlock()

	var matches []leads.Lead
	for _, l := range m.items {
		if f.Wilaya != "" && !strings.EqualFold(l.Wilaya, f.Wilaya) {
			continue
		}
		if f.Status != "" && l.Status != f.Status {
			continue
		}
		if f.Query != "" {
			hay := strings.ToLower(l.Name + " " + l.Address + " " + l.PhoneNational + " " + l.PhoneE164)
			if !strings.Contains(hay, f.Query) {
				continue
			}
		}
		matches = append(matches, l)
	}
	// Les plus récemment découverts d'abord, comme Postgres.
	sort.SliceStable(matches, func(i, j int) bool {
		if !matches[i].FirstSeenAt.Equal(matches[j].FirstSeenAt) {
			return matches[i].FirstSeenAt.After(matches[j].FirstSeenAt)
		}
		return matches[i].ID > matches[j].ID
	})

	total := len(matches)
	start := (f.Page - 1) * f.PerPage
	if start > total {
		start = total
	}
	end := start + f.PerPage
	if end > total {
		end = total
	}
	return Page{Items: append([]leads.Lead{}, matches[start:end]...), Total: total, Page: f.Page, PerPage: f.PerPage}, nil
}

func (m *Memory) Get(_ context.Context, id int64) (leads.Lead, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for _, l := range m.items {
		if l.ID == id {
			return l, nil
		}
	}
	return leads.Lead{}, ErrNotFound
}

func (m *Memory) Update(_ context.Context, id int64, u Update, now time.Time) (leads.Lead, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	for i := range m.items {
		if m.items[i].ID != id {
			continue
		}
		if u.Status != nil {
			m.items[i].Status = *u.Status
			// Première sortie de « nouveau » : on date le premier contact.
			if *u.Status != leads.StatusNouveau && m.items[i].ContactedAt == nil {
				t := now
				m.items[i].ContactedAt = &t
			}
		}
		if u.Note != nil {
			m.items[i].Note = *u.Note
		}
		m.items[i].UpdatedAt = now
		return m.items[i], nil
	}
	return leads.Lead{}, ErrNotFound
}

func (m *Memory) Stats(_ context.Context) (Stats, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	s := Stats{ByStatus: map[leads.Status]int{}, ByWilaya: map[string]int{}}
	for _, l := range m.items {
		s.Total++
		s.ByStatus[l.Status]++
		if l.Wilaya != "" {
			s.ByWilaya[l.Wilaya]++
		}
	}
	return s, nil
}

func (m *Memory) Wilayas(_ context.Context) ([]string, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	seen := map[string]bool{}
	var out []string
	for _, l := range m.items {
		if l.Wilaya != "" && !seen[l.Wilaya] {
			seen[l.Wilaya] = true
			out = append(out, l.Wilaya)
		}
	}
	sort.Strings(out)
	return out, nil
}
