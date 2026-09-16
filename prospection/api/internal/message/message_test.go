package message

import (
	"net/url"
	"strings"
	"testing"
)

var opts = Options{SiteURL: "https://plugin-dz.com", Campaign: "prospection", MaxPacks: 5}

func samplePacks() []Pack {
	return []Pack{
		{Name: "Pack 10 Chargeurs iPhone Hoco N7 20W", Price: 12500, TotalUnits: 10, Savings: 1500},
		{Name: "Pack 20 Chargeurs Hoco C12", Price: 16000, TotalUnits: 20, Savings: 3000},
	}
}

func TestBuild_Content(t *testing.T) {
	msg := Build("Boutique Ahmed", samplePacks(), opts)

	for _, want := range []string{
		"السلام عليكم",      // salutation
		"Boutique Ahmed",    // personnalisation
		"Plugin.dz",         // qui écrit
		"منتجات أصلية 100%", // les trois promesses
		"التوصيل مجاني إلى 69 ولاية",
		"الدفع عند الاستلام",
		"Pack 10 Chargeurs iPhone Hoco N7 20W — 12 500 دج (10 قطعة، توفر 1 500 دج)",
		"utm_source=whatsapp", "utm_medium=message", "utm_campaign=prospection",
		"https://plugin-dz.com/packs?",
	} {
		if !strings.Contains(msg, want) {
			t.Errorf("message sans %q :\n%s", want, msg)
		}
	}
}

func TestBuild_NoShopName(t *testing.T) {
	msg := Build("   ", nil, opts)
	if strings.Contains(msg, "، \n") {
		t.Error("virgule orpheline sans nom de boutique")
	}
	if strings.Contains(msg, "عروض الباقات") {
		t.Error("sans pack, pas de section packs")
	}
	if !strings.Contains(msg, "الكتالوغ الكامل") {
		t.Error("le lien vers le catalogue doit toujours être là")
	}
}

func TestBuild_MaxPacks(t *testing.T) {
	packs := make([]Pack, 8)
	for i := range packs {
		packs[i] = Pack{Name: "Pack " + string(rune('A'+i)), Price: 1000}
	}
	msg := Build("", packs, Options{SiteURL: "https://x", Campaign: "c", MaxPacks: 3})
	if got := strings.Count(msg, "• "); got != 3 {
		t.Errorf("attendu 3 packs cités, obtenu %d", got)
	}
}

func TestWhatsAppLink(t *testing.T) {
	link := WhatsAppLink("+213661234567", "Bonjour, un test 100%")
	if !strings.HasPrefix(link, "https://wa.me/213661234567?text=") {
		t.Fatalf("préfixe inattendu : %s", link)
	}
	if strings.Contains(link, "+") {
		t.Error("les espaces doivent être %20, pas + : WhatsApp les afficherait")
	}
	// Le texte doit revenir intact après décodage.
	u, err := url.Parse(link)
	if err != nil {
		t.Fatal(err)
	}
	if got := u.Query().Get("text"); got != "Bonjour, un test 100%" {
		t.Errorf("texte décodé : %q", got)
	}
}

func TestWhatsAppLink_ArabicRoundTrip(t *testing.T) {
	text := Build("محل النور", samplePacks(), opts)
	u, err := url.Parse(WhatsAppLink("+213661234567", text))
	if err != nil {
		t.Fatal(err)
	}
	if u.Query().Get("text") != text {
		t.Error("le message arabe doit survivre à l'encodage de l'URL")
	}
}

func TestTelLink(t *testing.T) {
	if got := TelLink("+213661234567"); got != "tel:+213661234567" {
		t.Errorf("obtenu %q", got)
	}
}

func TestFormatDA(t *testing.T) {
	for amount, want := range map[int]string{950: "950 دج", 12500: "12 500 دج", 1000000: "1 000 000 دج", 0: "0 دج"} {
		if got := formatDA(amount); got != want {
			t.Errorf("%d : obtenu %q, attendu %q", amount, got, want)
		}
	}
}
