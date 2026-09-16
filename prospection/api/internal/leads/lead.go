// Package leads porte le vocabulaire du service : un prospect, son état dans
// le suivi commercial, et les règles sur les numéros de téléphone algériens.
//
// Pas de base ni de HTTP ici : ce sont des types et des fonctions pures, que
// tout le reste du service partage et que les tests exercent sans rien
// démarrer.
package leads

import (
	"regexp"
	"strings"
	"time"
)

// Status est l'état d'un prospect dans le suivi commercial.
//
// Le cycle attendu : nouveau → contacte → interesse → client. Les deux états
// terminaux négatifs sont distincts pour une bonne raison : « pas intéressé »
// est une réponse commerciale, « ne pas contacter » est une demande de la
// personne — et cette dernière retire les boutons d'appel et WhatsApp.
type Status string

const (
	StatusNouveau        Status = "nouveau"
	StatusContacte       Status = "contacte"
	StatusInteresse      Status = "interesse"
	StatusClient         Status = "client"
	StatusPasInteresse   Status = "pas_interesse"
	StatusNePasContacter Status = "ne_pas_contacter"
)

// AllStatuses liste les états, dans l'ordre du cycle.
var AllStatuses = []Status{
	StatusNouveau, StatusContacte, StatusInteresse, StatusClient,
	StatusPasInteresse, StatusNePasContacter,
}

// Valid indique si la valeur est un état connu.
func (s Status) Valid() bool {
	for _, known := range AllStatuses {
		if s == known {
			return true
		}
	}
	return false
}

// Contactable indique si l'on peut encore proposer d'appeler ou d'écrire.
func (s Status) Contactable() bool {
	return s != StatusNePasContacter
}

// Lead est un prospect : une boutique repérée sur Google, avec de quoi la
// joindre et où l'on en est avec elle.
type Lead struct {
	ID int64 `json:"id"`

	// Source et SourceID identifient l'origine (« google_places » + place_id),
	// pour ne jamais créer deux fois la même boutique quand le collecteur
	// repasse.
	Source   string `json:"source"`
	SourceID string `json:"sourceId"`

	Name string `json:"name"`
	// PhoneE164 : forme internationale (+213…), unique quand présente.
	// PhoneNational : forme lisible (0…), celle que le gérant compose.
	PhoneE164     string `json:"phoneE164,omitempty"`
	PhoneNational string `json:"phoneNational,omitempty"`
	// IsMobile : seuls les mobiles (05/06/07) ont WhatsApp ; une ligne fixe ne
	// propose que l'appel.
	IsMobile bool `json:"isMobile"`

	Address string   `json:"address,omitempty"`
	Wilaya  string   `json:"wilaya,omitempty"`
	Lat     *float64 `json:"lat,omitempty"`
	Lng     *float64 `json:"lng,omitempty"`
	MapsURL string   `json:"mapsUrl,omitempty"`
	Website string   `json:"website,omitempty"`

	Rating      *float64 `json:"rating,omitempty"`
	RatingCount *int     `json:"ratingCount,omitempty"`

	Status Status `json:"status"`
	Note   string `json:"note,omitempty"`

	FirstSeenAt time.Time  `json:"firstSeenAt"`
	LastSeenAt  time.Time  `json:"lastSeenAt"`
	ContactedAt *time.Time `json:"contactedAt,omitempty"`
	UpdatedAt   time.Time  `json:"updatedAt"`
}

// Ingest est ce que le collecteur envoie pour une boutique. Le service en
// dérive les numéros normalisés et décide s'il crée ou met à jour.
type Ingest struct {
	Source   string   `json:"source"`
	SourceID string   `json:"sourceId"`
	Name     string   `json:"name"`
	Phone    string   `json:"phone"`
	Address  string   `json:"address"`
	Wilaya   string   `json:"wilaya"`
	Lat      *float64 `json:"lat"`
	Lng      *float64 `json:"lng"`
	MapsURL  string   `json:"mapsUrl"`
	Website  string   `json:"website"`
	Rating   *float64 `json:"rating"`
	// RatingCount peut manquer : Google ne le renvoie pas pour les fiches sans avis.
	RatingCount *int `json:"ratingCount"`
}

// Validate refuse une entrée qui ne permettrait ni d'identifier ni de joindre
// la boutique. Un nom sans numéro reste accepté : on peut vouloir l'appeler via
// sa fiche Google, ou compléter plus tard.
func (in Ingest) Validate() error {
	switch {
	case strings.TrimSpace(in.Source) == "":
		return errField("source")
	case strings.TrimSpace(in.SourceID) == "":
		return errField("sourceId")
	case strings.TrimSpace(in.Name) == "":
		return errField("name")
	}
	return nil
}

type errField string

func (e errField) Error() string { return "champ obligatoire manquant : " + string(e) }

// ---------------------------------------------------------------- téléphones

var (
	separators = regexp.MustCompile(`[\s.\-()]`)
	// Mobile : 05/06/07 + 8 chiffres. Fixe : 0 + indicatif régional 2x/3x/4x + 6 chiffres.
	mobilePattern   = regexp.MustCompile(`^0[567]\d{8}$`)
	landlinePattern = regexp.MustCompile(`^0[234]\d{7}$`)
)

// Phone est le résultat de la normalisation d'un numéro.
type Phone struct {
	National string // 0XXXXXXXXX
	E164     string // +213XXXXXXXXX
	Mobile   bool   // vrai pour 05/06/07 (WhatsApp possible)
}

// NormalizePhone ramène toutes les écritures d'un même numéro algérien à une
// forme unique — les mêmes règles que le suivi de commande de la boutique, pour
// qu'un numéro rapproché ici et là-bas soit le même à l'octet près.
//
//	« +213 661 23 45 67 », « 00213661234567 », « 0661-23-45-67 » → 0661234567
//
// Renvoie ok=false pour tout ce qui n'est pas un numéro algérien reconnu.
func NormalizePhone(raw string) (Phone, bool) {
	compact := separators.ReplaceAllString(strings.TrimSpace(raw), "")
	switch {
	case strings.HasPrefix(compact, "+213"):
		compact = "0" + compact[4:]
	case strings.HasPrefix(compact, "00213"):
		compact = "0" + compact[5:]
	case strings.HasPrefix(compact, "213") && (len(compact) == 12 || len(compact) == 11):
		// 213 + 9 chiffres (mobile) ou 213 + 8 chiffres (fixe), sans « + ».
		compact = "0" + compact[3:]
	}

	switch {
	case mobilePattern.MatchString(compact):
		return Phone{National: compact, E164: "+213" + compact[1:], Mobile: true}, true
	case landlinePattern.MatchString(compact):
		return Phone{National: compact, E164: "+213" + compact[1:], Mobile: false}, true
	}
	return Phone{}, false
}

// WhatsAppDigits est la forme attendue par wa.me : indicatif sans « + ».
func WhatsAppDigits(e164 string) string {
	return strings.TrimPrefix(e164, "+")
}
