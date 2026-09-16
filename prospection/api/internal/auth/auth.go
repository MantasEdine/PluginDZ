// Package auth protège les routes.
//
// Deux populations, deux mécanismes :
//   - les gérants, via le jeton admin de l'API boutique : même secret, mêmes
//     claims, vérifié ici sans appel réseau. Une seule connexion pour les deux
//     services ;
//   - le collecteur Python, qui n'est pas une personne : un secret partagé dans
//     un en-tête dédié, valable uniquement sur la route d'ingestion.
package auth

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
)

// Admin est l'identité lue dans un jeton valide — les champs signés par
// l'API boutique (voir server/src/middleware/auth.ts).
type Admin struct {
	ID    int    `json:"adminId"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Name  string `json:"name"`
}

type claims struct {
	Admin
	jwt.RegisteredClaims
}

type ctxKey struct{}

// FromContext renvoie l'admin authentifié sur la requête, s'il y en a un.
func FromContext(ctx context.Context) (Admin, bool) {
	a, ok := ctx.Value(ctxKey{}).(Admin)
	return a, ok
}

// Verifier vérifie les jetons admin.
type Verifier struct {
	secret []byte
}

// NewVerifier prépare la vérification avec le secret partagé.
func NewVerifier(secret string) *Verifier {
	return &Verifier{secret: []byte(secret)}
}

var errBadToken = errors.New("jeton invalide")

// Parse valide la signature et l'expiration, et rend l'identité.
func (v *Verifier) Parse(token string) (Admin, error) {
	var c claims
	parsed, err := jwt.ParseWithClaims(token, &c, func(t *jwt.Token) (any, error) {
		// Refuser tout autre algorithme que celui de la boutique : un jeton
		// « alg: none » ou RS256 forgé ne doit jamais passer.
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errBadToken
		}
		return v.secret, nil
	}, jwt.WithValidMethods([]string{"HS256"}))
	if err != nil || !parsed.Valid || c.Admin.ID == 0 {
		return Admin{}, errBadToken
	}
	return c.Admin, nil
}

// RequireAdmin exige un en-tête « Authorization: Bearer <jeton> » valide.
func (v *Verifier) RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		header := r.Header.Get("Authorization")
		if !strings.HasPrefix(header, "Bearer ") {
			unauthorized(w, "Authentification requise")
			return
		}
		admin, err := v.Parse(strings.TrimPrefix(header, "Bearer "))
		if err != nil {
			unauthorized(w, "Session expirée, reconnectez-vous")
			return
		}
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), ctxKey{}, admin)))
	})
}

// RequireCollector exige l'en-tête « X-Collector-Token » avec le secret partagé.
// La comparaison est à temps constant : on ne laisse pas deviner le secret
// octet par octet en mesurant le temps de réponse.
func RequireCollector(token string) func(http.Handler) http.Handler {
	expected := []byte(token)
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			got := []byte(r.Header.Get("X-Collector-Token"))
			if len(got) == 0 || subtle.ConstantTimeCompare(got, expected) != 1 {
				unauthorized(w, "Jeton collecteur invalide")
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}

func unauthorized(w http.ResponseWriter, msg string) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusUnauthorized)
	_ = json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
