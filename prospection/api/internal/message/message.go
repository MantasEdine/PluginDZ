// Package message compose le message WhatsApp envoyé à un prospect et les liens
// « écrire » / « appeler ».
//
// Le message est en arabe : c'est la langue dans laquelle un gérant de boutique
// algérien lit un message commercial d'un inconnu sans le fermer. Les noms de
// packs restent tels quels (marques et modèles, en caractères latins) — ce sont
// des noms propres, pas des phrases.
//
// Le texte n'est envoyé par personne ici : il est placé dans un lien wa.me que
// le gérant ouvre, relit, et envoie lui-même, un prospect à la fois. Aucun envoi
// automatique — c'est à la fois la règle de WhatsApp et la seule façon de ne pas
// finir bloqué.
package message

import (
	"net/url"
	"strconv"
	"strings"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/leads"
)

// Pack est ce qu'on cite d'une offre : son nom, son prix, ce qu'elle contient
// et ce qu'elle fait gagner. Les champs viennent tels quels de l'API boutique.
type Pack struct {
	Name       string `json:"name"`
	Slug       string `json:"slug"`
	Price      int    `json:"price"`
	TotalUnits int    `json:"totalUnits"`
	Savings    int    `json:"savings"`
	IsFeatured bool   `json:"isFeatured"`
}

// Options règle ce qui varie d'un déploiement à l'autre.
type Options struct {
	// SiteURL : adresse du site, sans barre finale.
	SiteURL string
	// Campaign : étiquette utm_campaign posée sur le lien, pour retrouver ces
	// ventes dans le tableau « Performance des campagnes » de la boutique.
	Campaign string
	// MaxPacks : nombre de packs cités au plus.
	MaxPacks int
}

// CatalogueURL est le lien mis dans le message : la page des packs, marquée
// pour l'attribution. Le site mémorise ces paramètres à l'arrivée et les
// rattache à la commande.
func CatalogueURL(opts Options) string {
	q := url.Values{}
	q.Set("utm_source", "whatsapp")
	q.Set("utm_medium", "message")
	q.Set("utm_campaign", opts.Campaign)
	return opts.SiteURL + "/packs?" + q.Encode()
}

// Build compose le message pour une boutique donnée.
//
// Si shopName est vide, la salutation reste générale. Les packs sont cités
// dans l'ordre reçu, limités à opts.MaxPacks ; un message sans pack reste
// valide (le lien vers le catalogue suffit).
func Build(shopName string, packs []Pack, opts Options) string {
	var b strings.Builder

	// Salutation, personnalisée si l'on connaît le nom de la boutique.
	b.WriteString("السلام عليكم ورحمة الله")
	if name := strings.TrimSpace(shopName); name != "" {
		b.WriteString("، ")
		b.WriteString(name)
	}
	b.WriteString("\n")
	b.WriteString("معكم Plugin.dz، مورد شواحن وإكسسوارات الهاتف بالجملة ونصف الجملة في الجزائر 🇩🇿\n\n")

	// Les trois promesses de la boutique — les mêmes que sur le site.
	b.WriteString("✅ منتجات أصلية 100%\n")
	b.WriteString("🚚 التوصيل مجاني إلى 69 ولاية\n")
	b.WriteString("💵 الدفع عند الاستلام\n")

	// Les prix sont donnés à la pièce : c'est ce qu'un revendeur compare
	// d'un fournisseur à l'autre. La vente reste par pack (5, 10 pièces ou
	// plus) — la note qui suit la liste le dit, une seule fois, plutôt que
	// d'alourdir chaque ligne.
	if len(packs) > 0 {
		b.WriteString("\n📦 أسعارنا الحالية (سعر القطعة الواحدة):\n")
		limit := opts.MaxPacks
		if limit <= 0 || limit > len(packs) {
			limit = len(packs)
		}
		for _, p := range packs[:limit] {
			b.WriteString("• ")
			b.WriteString(p.Name)
			b.WriteString(" — ")
			b.WriteString(formatDA(UnitPrice(p)))
			b.WriteString(" للقطعة\n")
		}
		b.WriteString("ℹ️ البيع بالباقات: 5 أو 10 قطع فأكثر حسب المنتج.\n")
	}

	b.WriteString("\n🛒 الكتالوغ الكامل والطلب مباشرة من هنا:\n")
	b.WriteString(CatalogueURL(opts))
	b.WriteString("\n\nنحن في الخدمة لأي سؤال، ومرحباً بكم 🙏")

	return b.String()
}

// WhatsAppLink ouvre une conversation avec le numéro, le message déjà saisi.
//
// wa.me attend l'indicatif sans « + » et le texte encodé. url.QueryEscape
// écrit les espaces en « + », que WhatsApp affiche parfois tels quels : on
// les remplace par %20, compris partout.
func WhatsAppLink(e164, text string) string {
	digits := leads.WhatsAppDigits(e164)
	encoded := strings.ReplaceAll(url.QueryEscape(text), "+", "%20")
	return "https://wa.me/" + digits + "?text=" + encoded
}

// TelLink compose le lien « appeler » : le téléphone ouvre le composeur.
func TelLink(e164 string) string {
	return "tel:" + e164
}

// UnitPrice est le prix d'une pièce dans le pack, arrondi au dinar. Un pack
// sans quantité connue (0 ou 1) vaut son prix tel quel.
func UnitPrice(p Pack) int {
	if p.TotalUnits <= 1 {
		return p.Price
	}
	return (p.Price + p.TotalUnits/2) / p.TotalUnits
}

// formatDA écrit un montant en dinars, chiffres collés, avec le symbole
// arabe — « 12500 دج ». Pas de séparateur de milliers : dans un message
// WhatsApp, une espace au milieu d'un nombre se lit comme deux nombres.
func formatDA(amount int) string {
	return strconv.Itoa(amount) + " دج"
}
