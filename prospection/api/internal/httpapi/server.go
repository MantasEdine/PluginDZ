// Package httpapi expose le service en HTTP/JSON.
//
// Trois familles de routes :
//   - /health                 : pour l'hébergeur ;
//   - /internal/leads         : ingestion par le collecteur (jeton dédié) ;
//   - /leads, /stats, /wilayas: le back-office (jeton admin de la boutique).
//
// Les réponses suivent la forme de l'API boutique — { "data": … } en succès,
// { "error": "…" } sinon — pour que le back-office parle aux deux de la même
// façon.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/auth"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/config"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/leads"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/message"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/store"
)

// PacksSource fournit les offres à citer. L'implémentation réelle interroge la
// boutique ; les tests en donnent une fixe.
type PacksSource interface {
	Packs(ctx context.Context) ([]message.Pack, error)
}

// Server tient les dépendances et le routeur.
type Server struct {
	cfg      config.Config
	store    store.Store
	packs    PacksSource
	verifier *auth.Verifier
	now      func() time.Time
	mux      *http.ServeMux
}

// New assemble le serveur. `now` est injectable pour des tests déterministes.
func New(cfg config.Config, st store.Store, packs PacksSource, now func() time.Time) *Server {
	if now == nil {
		now = time.Now
	}
	s := &Server{cfg: cfg, store: st, packs: packs, verifier: auth.NewVerifier(cfg.JWTSecret), now: now, mux: http.NewServeMux()}
	s.routes()
	return s
}

// Handler renvoie le point d'entrée HTTP, CORS compris.
func (s *Server) Handler() http.Handler {
	return s.cors(s.mux)
}

func (s *Server) routes() {
	admin := s.verifier.RequireAdmin
	collector := auth.RequireCollector(s.cfg.CollectorToken)

	s.mux.HandleFunc("GET /health", s.health)
	s.mux.Handle("POST /internal/leads", collector(http.HandlerFunc(s.ingest)))

	s.mux.Handle("GET /leads", admin(http.HandlerFunc(s.list)))
	s.mux.Handle("GET /leads/{id}", admin(http.HandlerFunc(s.get)))
	s.mux.Handle("PATCH /leads/{id}", admin(http.HandlerFunc(s.update)))
	s.mux.Handle("GET /leads/{id}/contact", admin(http.HandlerFunc(s.contact)))
	s.mux.Handle("GET /stats", admin(http.HandlerFunc(s.stats)))
	s.mux.Handle("GET /wilayas", admin(http.HandlerFunc(s.wilayas)))
}

// ------------------------------------------------------------------ routes

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "service": "plugin-dz-prospection"})
}

// ingestResult dit au collecteur ce qu'il est advenu de son lot.
type ingestResult struct {
	Created  int            `json:"created"`
	Updated  int            `json:"updated"`
	Skipped  []ingestSkip   `json:"skipped"`
	Warnings []ingestSkip   `json:"warnings"`
}

type ingestSkip struct {
	SourceID string `json:"sourceId"`
	Reason   string `json:"reason"`
}

// maxIngestBatch borne un lot : au-delà, le collecteur découpe.
const maxIngestBatch = 500

func (s *Server) ingest(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Leads []leads.Ingest `json:"leads"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "corps JSON invalide")
		return
	}
	if len(body.Leads) == 0 {
		writeError(w, http.StatusBadRequest, "aucun prospect dans le lot")
		return
	}
	if len(body.Leads) > maxIngestBatch {
		writeError(w, http.StatusBadRequest, "lot trop grand : "+strconv.Itoa(maxIngestBatch)+" prospects au plus")
		return
	}

	res := ingestResult{Skipped: []ingestSkip{}, Warnings: []ingestSkip{}}
	now := s.now()
	for _, in := range body.Leads {
		if err := in.Validate(); err != nil {
			res.Skipped = append(res.Skipped, ingestSkip{SourceID: in.SourceID, Reason: err.Error()})
			continue
		}
		// Un numéro absent ou illisible n'empêche pas d'enregistrer la boutique :
		// on garde sa fiche, on signale juste qu'on ne pourra pas l'écrire.
		var phone *leads.Phone
		if strings.TrimSpace(in.Phone) != "" {
			if p, ok := leads.NormalizePhone(in.Phone); ok {
				phone = &p
			} else {
				res.Warnings = append(res.Warnings, ingestSkip{SourceID: in.SourceID, Reason: "numéro non reconnu : " + in.Phone})
			}
		}
		_, created, err := s.store.Upsert(r.Context(), in, phone, now)
		if err != nil {
			log.Printf("[ingest] %s : %v", in.SourceID, err)
			res.Skipped = append(res.Skipped, ingestSkip{SourceID: in.SourceID, Reason: "erreur d'enregistrement"})
			continue
		}
		if created {
			res.Created++
		} else {
			res.Updated++
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": res})
}

func (s *Server) list(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	f := store.ListFilter{
		Wilaya: q.Get("wilaya"),
		Status: leads.Status(q.Get("status")),
		Query:  q.Get("q"),
	}
	if f.Status != "" && !f.Status.Valid() {
		writeError(w, http.StatusBadRequest, "statut inconnu")
		return
	}
	f.Page, _ = strconv.Atoi(q.Get("page"))
	f.PerPage, _ = strconv.Atoi(q.Get("perPage"))

	page, err := s.store.List(r.Context(), f)
	if err != nil {
		s.internal(w, "list", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": page})
}

func (s *Server) get(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	l, err := s.store.Get(r.Context(), id)
	if err != nil {
		s.storeError(w, "get", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": l})
}

func (s *Server) update(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	var body struct {
		Status *leads.Status `json:"status"`
		Note   *string       `json:"note"`
	}
	if err := decodeJSON(r, &body); err != nil {
		writeError(w, http.StatusBadRequest, "corps JSON invalide")
		return
	}
	if body.Status == nil && body.Note == nil {
		writeError(w, http.StatusBadRequest, "rien à modifier")
		return
	}
	if body.Status != nil && !body.Status.Valid() {
		writeError(w, http.StatusBadRequest, "statut inconnu")
		return
	}
	if body.Note != nil && len(*body.Note) > 2000 {
		writeError(w, http.StatusBadRequest, "note trop longue (2000 caractères au plus)")
		return
	}
	l, err := s.store.Update(r.Context(), id, store.Update{Status: body.Status, Note: body.Note}, s.now())
	if err != nil {
		s.storeError(w, "update", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": l})
}

// contactPayload : de quoi afficher les deux boutons et relire le message.
type contactPayload struct {
	Contactable bool   `json:"contactable"`
	Message     string `json:"message"`
	WhatsAppURL string `json:"whatsappUrl,omitempty"`
	TelURL      string `json:"telUrl,omitempty"`
	PacksCited  int    `json:"packsCited"`
}

func (s *Server) contact(w http.ResponseWriter, r *http.Request) {
	id, ok := pathID(w, r)
	if !ok {
		return
	}
	l, err := s.store.Get(r.Context(), id)
	if err != nil {
		s.storeError(w, "contact", err)
		return
	}

	packs, err := s.packs.Packs(r.Context())
	if err != nil {
		// Sans packs, le message reste utile : on le compose quand même.
		log.Printf("[contact] packs indisponibles : %v", err)
		packs = nil
	}
	opts := message.Options{SiteURL: s.cfg.SiteURL, Campaign: "prospection", MaxPacks: s.cfg.MessageMaxPacks}
	text := message.Build(l.Name, packs, opts)
	cited := len(packs)
	if cited > opts.MaxPacks {
		cited = opts.MaxPacks
	}

	out := contactPayload{Contactable: l.Status.Contactable(), Message: text, PacksCited: cited}
	// Les liens ne sont proposés que si la personne n'a pas demandé à ne plus
	// être contactée, et seulement ceux qui ont un sens pour son numéro.
	if out.Contactable && l.PhoneE164 != "" {
		out.TelURL = message.TelLink(l.PhoneE164)
		if l.IsMobile {
			out.WhatsAppURL = message.WhatsAppLink(l.PhoneE164, text)
		}
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": out})
}

func (s *Server) stats(w http.ResponseWriter, r *http.Request) {
	st, err := s.store.Stats(r.Context())
	if err != nil {
		s.internal(w, "stats", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": st})
}

func (s *Server) wilayas(w http.ResponseWriter, r *http.Request) {
	ws, err := s.store.Wilayas(r.Context())
	if err != nil {
		s.internal(w, "wilayas", err)
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"data": ws})
}

// -------------------------------------------------------------- utilitaires

func pathID(w http.ResponseWriter, r *http.Request) (int64, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	if err != nil || id <= 0 {
		writeError(w, http.StatusBadRequest, "identifiant invalide")
		return 0, false
	}
	return id, true
}

func decodeJSON(r *http.Request, dst any) error {
	dec := json.NewDecoder(http.MaxBytesReader(nil, r.Body, 2<<20)) // 2 Mo
	dec.DisallowUnknownFields()
	return dec.Decode(dst)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}

func (s *Server) internal(w http.ResponseWriter, where string, err error) {
	log.Printf("[%s] %v", where, err)
	writeError(w, http.StatusInternalServerError, "erreur interne")
}

func (s *Server) storeError(w http.ResponseWriter, where string, err error) {
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, "prospect introuvable")
		return
	}
	s.internal(w, where, err)
}

// cors n'ouvre le service qu'aux origines configurées (le back-office). Les
// requêtes serveur-à-serveur n'ont pas d'Origin et passent telles quelles.
func (s *Server) cors(next http.Handler) http.Handler {
	allowed := map[string]bool{}
	for _, o := range s.cfg.CORSOrigins {
		allowed[o] = true
	}
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")
		if origin != "" && (allowed[origin] || allowed["*"]) {
			w.Header().Set("Access-Control-Allow-Origin", origin)
			w.Header().Set("Vary", "Origin")
			w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Collector-Token")
			w.Header().Set("Access-Control-Max-Age", "600")
		}
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		next.ServeHTTP(w, r)
	})
}
