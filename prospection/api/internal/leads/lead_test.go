package leads

import "testing"

func TestNormalizePhone_MobileFormats(t *testing.T) {
	// Toutes les écritures d'un même mobile doivent donner la même forme :
	// c'est ce qui permet de ne jamais enregistrer deux fois la même boutique.
	for _, written := range []string{
		"0661234567", "06 61 23 45 67", "0661.23.45.67", "0661-23-45-67",
		"+213661234567", "+213 661 23 45 67", "00213661234567", "213661234567", "(0661) 234567",
	} {
		p, ok := NormalizePhone(written)
		if !ok {
			t.Fatalf("%q : non reconnu", written)
		}
		if p.National != "0661234567" || p.E164 != "+213661234567" || !p.Mobile {
			t.Errorf("%q : obtenu %+v", written, p)
		}
	}
}

func TestNormalizePhone_Landline(t *testing.T) {
	// Une boutique a souvent un fixe : on l'accepte, mais il n'a pas WhatsApp.
	p, ok := NormalizePhone("021 45 67 89")
	if !ok {
		t.Fatal("fixe non reconnu")
	}
	if p.National != "021456789" || p.E164 != "+21321456789" || p.Mobile {
		t.Errorf("obtenu %+v", p)
	}
}

func TestNormalizePhone_Rejects(t *testing.T) {
	for _, bad := range []string{"", "0461234567", "066123456", "06612345678", "0661234abc", "+33612345678", "2131234567"} {
		if _, ok := NormalizePhone(bad); ok {
			t.Errorf("%q : aurait dû être refusé", bad)
		}
	}
}

func TestWhatsAppDigits(t *testing.T) {
	if got := WhatsAppDigits("+213661234567"); got != "213661234567" {
		t.Errorf("obtenu %q", got)
	}
}

func TestStatus(t *testing.T) {
	for _, s := range AllStatuses {
		if !s.Valid() {
			t.Errorf("%s devrait être valide", s)
		}
	}
	if Status("livre").Valid() {
		t.Error("un statut de commande n'est pas un statut de prospect")
	}
	if StatusNePasContacter.Contactable() {
		t.Error("« ne pas contacter » doit retirer les boutons")
	}
	if !StatusPasInteresse.Contactable() {
		t.Error("« pas intéressé » est une réponse, pas une interdiction : on peut relancer plus tard")
	}
}

func TestIngestValidate(t *testing.T) {
	ok := Ingest{Source: "google_places", SourceID: "abc", Name: "Boutique"}
	if err := ok.Validate(); err != nil {
		t.Fatalf("entrée valide refusée : %v", err)
	}
	for _, bad := range []Ingest{
		{SourceID: "abc", Name: "x"}, {Source: "g", Name: "x"}, {Source: "g", SourceID: "abc"},
	} {
		if err := bad.Validate(); err == nil {
			t.Errorf("%+v : aurait dû être refusé", bad)
		}
	}
}
