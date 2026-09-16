package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/config"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/leads"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/message"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/store"
)

const (
	testSecret    = "secret-de-test"
	testCollector = "jeton-collecteur-de-test"
)

// fixedPacks joue le rôle de la boutique : deux offres, toujours les mêmes.
type fixedPacks struct{ fail bool }

func (f fixedPacks) Packs(context.Context) ([]message.Pack, error) {
	if f.fail {
		return nil, context.DeadlineExceeded
	}
	return []message.Pack{
		{Name: "Pack 10 Chargeurs iPhone Hoco N7 20W", Price: 12500, TotalUnits: 10, Savings: 1500},
		{Name: "Pack 20 Chargeurs Hoco C12", Price: 16000, TotalUnits: 20, Savings: 3000},
	}, nil
}

func newTestServer(t *testing.T, packs PacksSource) (*Server, *store.Memory) {
	t.Helper()
	st := store.NewMemory()
	cfg := config.Config{
		JWTSecret: testSecret, CollectorToken: testCollector,
		SiteURL: "https://plugin-dz.com", CORSOrigins: []string{"http://localhost:3000"}, MessageMaxPacks: 5,
	}
	fixed := time.Date(2026, 9, 16, 10, 0, 0, 0, time.UTC)
	return New(cfg, st, packs, func() time.Time { return fixed }), st
}

// adminToken signe un jeton exactement comme l'API boutique le fait.
func adminToken(t *testing.T, secret string, exp time.Duration) string {
	t.Helper()
	claims := jwt.MapClaims{
		"adminId": 1, "email": "admin@plugin.dz", "role": "owner", "name": "Propriétaire",
		"exp": time.Now().Add(exp).Unix(),
	}
	tok, err := jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString([]byte(secret))
	if err != nil {
		t.Fatal(err)
	}
	return tok
}

func do(t *testing.T, s *Server, method, path string, body any, headers map[string]string) (*httptest.ResponseRecorder, map[string]any) {
	t.Helper()
	var buf bytes.Buffer
	if body != nil {
		if err := json.NewEncoder(&buf).Encode(body); err != nil {
			t.Fatal(err)
		}
	}
	req := httptest.NewRequest(method, path, &buf)
	req.Header.Set("Content-Type", "application/json")
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	var out map[string]any
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	return rec, out
}

func ingestBatch(t *testing.T, s *Server, items ...leads.Ingest) map[string]any {
	t.Helper()
	rec, out := do(t, s, http.MethodPost, "/internal/leads", map[string]any{"leads": items},
		map[string]string{"X-Collector-Token": testCollector})
	if rec.Code != http.StatusOK {
		t.Fatalf("ingest : HTTP %d %s", rec.Code, rec.Body.String())
	}
	return out["data"].(map[string]any)
}

// ---------------------------------------------------------------- auth

func TestAdminRoutes_RequireToken(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	for _, path := range []string{"/leads", "/leads/1", "/leads/1/contact", "/stats", "/wilayas"} {
		rec, _ := do(t, s, http.MethodGet, path, nil, nil)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s sans jeton : HTTP %d, attendu 401", path, rec.Code)
		}
	}
}

func TestAdminRoutes_RejectBadTokens(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	for name, tok := range map[string]string{
		"mauvais secret": adminToken(t, "autre-secret", time.Hour),
		"expiré":         adminToken(t, testSecret, -time.Minute),
		"n'importe quoi": "abc.def.ghi",
	} {
		rec, _ := do(t, s, http.MethodGet, "/leads", nil, map[string]string{"Authorization": "Bearer " + tok})
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s : HTTP %d, attendu 401", name, rec.Code)
		}
	}
}

func TestAdminRoutes_AcceptShopToken(t *testing.T) {
	// Le point du partage de secret : un jeton signé par la boutique passe ici.
	s, _ := newTestServer(t, fixedPacks{})
	rec, _ := do(t, s, http.MethodGet, "/leads", nil, map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)})
	if rec.Code != http.StatusOK {
		t.Fatalf("HTTP %d : %s", rec.Code, rec.Body.String())
	}
}

func TestIngest_RequiresCollectorToken(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	body := map[string]any{"leads": []leads.Ingest{{Source: "g", SourceID: "1", Name: "x"}}}
	for name, h := range map[string]map[string]string{
		"sans jeton":       nil,
		"mauvais jeton":    {"X-Collector-Token": "faux"},
		"jeton admin seul": {"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)},
	} {
		rec, _ := do(t, s, http.MethodPost, "/internal/leads", body, h)
		if rec.Code != http.StatusUnauthorized {
			t.Errorf("%s : HTTP %d, attendu 401", name, rec.Code)
		}
	}
}

// ---------------------------------------------------------------- ingestion

func TestIngest_CreatesThenUpdates(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	in := leads.Ingest{Source: "google_places", SourceID: "p1", Name: "Boutique Ahmed", Phone: "+213 661 23 45 67", Wilaya: "Alger"}

	first := ingestBatch(t, s, in)
	if first["created"].(float64) != 1 || first["updated"].(float64) != 0 {
		t.Fatalf("premier passage : %v", first)
	}
	// Le collecteur repasse : même fiche, numéro écrit autrement, adresse en plus.
	in.Phone = "0661234567"
	in.Address = "Rue Didouche Mourad"
	second := ingestBatch(t, s, in)
	if second["created"].(float64) != 0 || second["updated"].(float64) != 1 {
		t.Fatalf("second passage : %v", second)
	}

	rec, out := do(t, s, http.MethodGet, "/leads", nil, map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)})
	if rec.Code != http.StatusOK {
		t.Fatal(rec.Body.String())
	}
	page := out["data"].(map[string]any)
	if page["total"].(float64) != 1 {
		t.Fatalf("un seul prospect attendu, total=%v", page["total"])
	}
	item := page["items"].([]any)[0].(map[string]any)
	if item["phoneNational"] != "0661234567" || item["phoneE164"] != "+213661234567" || item["address"] != "Rue Didouche Mourad" {
		t.Errorf("fusion incorrecte : %v", item)
	}
}

func TestIngest_SamePhoneDifferentSource_IsOneLead(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s, leads.Ingest{Source: "google_places", SourceID: "a", Name: "Fiche 1", Phone: "0661000000"})
	res := ingestBatch(t, s, leads.Ingest{Source: "google_places", SourceID: "b", Name: "Fiche 2", Phone: "+213661000000"})
	if res["created"].(float64) != 0 || res["updated"].(float64) != 1 {
		t.Errorf("deux fiches, un numéro : doit fusionner, obtenu %v", res)
	}
}

func TestIngest_KeepsSalesTracking(t *testing.T) {
	// Une nouvelle collecte ne doit jamais effacer le statut ni la note posés
	// par le gérant : c'est tout le travail commercial qui serait perdu.
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "p1", Name: "Boutique", Phone: "0661234567"})
	auth := map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)}
	do(t, s, http.MethodPatch, "/leads/1", map[string]any{"status": "interesse", "note": "rappeler jeudi"}, auth)

	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "p1", Name: "Boutique (nouveau nom)", Phone: "0661234567"})
	_, out := do(t, s, http.MethodGet, "/leads/1", nil, auth)
	l := out["data"].(map[string]any)
	if l["status"] != "interesse" || l["note"] != "rappeler jeudi" {
		t.Errorf("suivi écrasé par la collecte : %v", l)
	}
	if l["name"] != "Boutique (nouveau nom)" {
		t.Errorf("le nom, lui, doit suivre la fiche : %v", l["name"])
	}
}

func TestIngest_SkipsInvalidAndWarnsOnBadPhone(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	res := ingestBatch(t, s,
		leads.Ingest{Source: "g", SourceID: "ok", Name: "Bien"},
		leads.Ingest{Source: "g", SourceID: "", Name: "Sans identifiant"},
		leads.Ingest{Source: "g", SourceID: "tel", Name: "Numéro étranger", Phone: "+33 6 12 34 56 78"},
	)
	if res["created"].(float64) != 2 {
		t.Errorf("2 créations attendues (le numéro illisible n'empêche pas la fiche), obtenu %v", res)
	}
	if len(res["skipped"].([]any)) != 1 || len(res["warnings"].([]any)) != 1 {
		t.Errorf("1 ignoré + 1 avertissement attendus, obtenu %v", res)
	}
}

func TestIngest_RejectsEmptyAndOversized(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	h := map[string]string{"X-Collector-Token": testCollector}
	rec, _ := do(t, s, http.MethodPost, "/internal/leads", map[string]any{"leads": []any{}}, h)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("lot vide : HTTP %d", rec.Code)
	}
	big := make([]leads.Ingest, maxIngestBatch+1)
	for i := range big {
		big[i] = leads.Ingest{Source: "g", SourceID: "x", Name: "x"}
	}
	rec, _ = do(t, s, http.MethodPost, "/internal/leads", map[string]any{"leads": big}, h)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("lot trop grand : HTTP %d", rec.Code)
	}
}

// ---------------------------------------------------------------- back-office

func TestList_Filters(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s,
		leads.Ingest{Source: "g", SourceID: "1", Name: "Alpha Phone", Wilaya: "Alger", Phone: "0661000001"},
		leads.Ingest{Source: "g", SourceID: "2", Name: "Beta Mobile", Wilaya: "Oran", Phone: "0661000002"},
		leads.Ingest{Source: "g", SourceID: "3", Name: "Gamma Store", Wilaya: "Oran", Phone: "0661000003"},
	)
	auth := map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)}
	do(t, s, http.MethodPatch, "/leads/3", map[string]any{"status": "client"}, auth)

	cases := map[string]int{
		"/leads":                            3,
		"/leads?wilaya=oran":                2,
		"/leads?status=client":              1,
		"/leads?q=beta":                     1,
		"/leads?q=0661000001":               1,
		"/leads?wilaya=Oran&status=nouveau": 1,
	}
	for path, want := range cases {
		_, out := do(t, s, http.MethodGet, path, nil, auth)
		if got := out["data"].(map[string]any)["total"].(float64); int(got) != want {
			t.Errorf("%s : %d résultats, attendu %d", path, int(got), want)
		}
	}
	rec, _ := do(t, s, http.MethodGet, "/leads?status=inconnu", nil, auth)
	if rec.Code != http.StatusBadRequest {
		t.Errorf("statut inconnu : HTTP %d", rec.Code)
	}
}

func TestUpdate_StatusAndContactedAt(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "1", Name: "Boutique"})
	auth := map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)}

	_, out := do(t, s, http.MethodPatch, "/leads/1", map[string]any{"status": "contacte"}, auth)
	l := out["data"].(map[string]any)
	if l["status"] != "contacte" || l["contactedAt"] == nil {
		t.Errorf("premier contact non daté : %v", l)
	}
	for name, body := range map[string]map[string]any{
		"statut inconnu": {"status": "livre"},
		"rien":           {},
		"note géante":    {"note": strings.Repeat("x", 2001)},
	} {
		rec, _ := do(t, s, http.MethodPatch, "/leads/1", body, auth)
		if rec.Code != http.StatusBadRequest {
			t.Errorf("%s : HTTP %d, attendu 400", name, rec.Code)
		}
	}
	rec, _ := do(t, s, http.MethodPatch, "/leads/999", map[string]any{"status": "client"}, auth)
	if rec.Code != http.StatusNotFound {
		t.Errorf("prospect absent : HTTP %d", rec.Code)
	}
}

func TestContact_MobileGetsBothLinks(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "1", Name: "محل النور", Phone: "0661234567"})
	auth := map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)}

	_, out := do(t, s, http.MethodGet, "/leads/1/contact", nil, auth)
	c := out["data"].(map[string]any)
	if c["contactable"] != true || c["telUrl"] != "tel:+213661234567" {
		t.Fatalf("liens : %v", c)
	}
	wa, _ := c["whatsappUrl"].(string)
	if !strings.HasPrefix(wa, "https://wa.me/213661234567?text=") {
		t.Fatalf("lien WhatsApp : %q", wa)
	}
	// Le message dans le lien est celui rendu à part, et il cite les packs.
	u, _ := url.Parse(wa)
	if u.Query().Get("text") != c["message"] {
		t.Error("le texte du lien doit être exactement le message affiché")
	}
	msg := c["message"].(string)
	for _, want := range []string{"محل النور", "Pack 10 Chargeurs iPhone Hoco N7 20W", "1250 دج للقطعة", "utm_campaign=prospection"} {
		if !strings.Contains(msg, want) {
			t.Errorf("message sans %q", want)
		}
	}
	if c["packsCited"].(float64) != 2 {
		t.Errorf("packsCited = %v", c["packsCited"])
	}
}

func TestContact_LandlineHasNoWhatsApp(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "1", Name: "Boutique", Phone: "021 45 67 89"})
	_, out := do(t, s, http.MethodGet, "/leads/1/contact", nil, map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)})
	c := out["data"].(map[string]any)
	if _, has := c["whatsappUrl"]; has {
		t.Error("un fixe n'a pas WhatsApp")
	}
	if c["telUrl"] != "tel:+21321456789" {
		t.Errorf("appel : %v", c["telUrl"])
	}
}

func TestContact_DoNotContactHidesLinks(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "1", Name: "Boutique", Phone: "0661234567"})
	auth := map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)}
	do(t, s, http.MethodPatch, "/leads/1", map[string]any{"status": "ne_pas_contacter"}, auth)

	_, out := do(t, s, http.MethodGet, "/leads/1/contact", nil, auth)
	c := out["data"].(map[string]any)
	if c["contactable"] != false {
		t.Error("doit être non contactable")
	}
	if _, has := c["whatsappUrl"]; has {
		t.Error("pas de WhatsApp pour qui a demandé à ne plus être contacté")
	}
	if _, has := c["telUrl"]; has {
		t.Error("pas d'appel non plus")
	}
}

func TestContact_ShopDown_StillBuildsMessage(t *testing.T) {
	// Boutique injoignable : le message part sans packs plutôt que d'échouer.
	s, _ := newTestServer(t, fixedPacks{fail: true})
	ingestBatch(t, s, leads.Ingest{Source: "g", SourceID: "1", Name: "Boutique", Phone: "0661234567"})
	rec, out := do(t, s, http.MethodGet, "/leads/1/contact", nil, map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)})
	if rec.Code != http.StatusOK {
		t.Fatalf("HTTP %d", rec.Code)
	}
	c := out["data"].(map[string]any)
	if c["packsCited"].(float64) != 0 || !strings.Contains(c["message"].(string), "الكتالوغ") {
		t.Errorf("message dégradé incorrect : %v", c)
	}
}

func TestStatsAndWilayas(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	ingestBatch(t, s,
		leads.Ingest{Source: "g", SourceID: "1", Name: "A", Wilaya: "Alger"},
		leads.Ingest{Source: "g", SourceID: "2", Name: "B", Wilaya: "Oran"},
		leads.Ingest{Source: "g", SourceID: "3", Name: "C", Wilaya: "Oran"},
	)
	auth := map[string]string{"Authorization": "Bearer " + adminToken(t, testSecret, time.Hour)}
	_, out := do(t, s, http.MethodGet, "/stats", nil, auth)
	st := out["data"].(map[string]any)
	if st["total"].(float64) != 3 || st["byWilaya"].(map[string]any)["Oran"].(float64) != 2 {
		t.Errorf("stats : %v", st)
	}
	_, out = do(t, s, http.MethodGet, "/wilayas", nil, auth)
	if ws := out["data"].([]any); len(ws) != 2 || ws[0] != "Alger" || ws[1] != "Oran" {
		t.Errorf("wilayas : %v", ws)
	}
}

func TestCORS(t *testing.T) {
	s, _ := newTestServer(t, fixedPacks{})
	req := httptest.NewRequest(http.MethodOptions, "/leads", nil)
	req.Header.Set("Origin", "http://localhost:3000")
	rec := httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Code != http.StatusNoContent || rec.Header().Get("Access-Control-Allow-Origin") != "http://localhost:3000" {
		t.Errorf("préflight : %d %v", rec.Code, rec.Header())
	}
	req = httptest.NewRequest(http.MethodOptions, "/leads", nil)
	req.Header.Set("Origin", "https://site-inconnu.example")
	rec = httptest.NewRecorder()
	s.Handler().ServeHTTP(rec, req)
	if rec.Header().Get("Access-Control-Allow-Origin") != "" {
		t.Error("une origine inconnue ne doit rien recevoir")
	}
}
