// Package config lit la configuration du service dans l'environnement.
//
// Une seule fonction, Load, qui refuse de démarrer si une valeur indispensable
// manque en production : mieux vaut un service qui ne part pas qu'un service qui
// tourne sans secret. En développement, des valeurs par défaut alignées sur
// celles de l'API boutique (même JWT_SECRET) permettent de tout lancer sans
// rien configurer et de réutiliser le jeton admin du back-office.
package config

import (
	"fmt"
	"os"
	"strconv"
	"strings"
)

// Config regroupe tout ce dont le service a besoin pour tourner.
type Config struct {
	// Port HTTP d'écoute.
	Port string
	// DatabaseURL : Postgres propre au service (URL pgx / libpq).
	DatabaseURL string
	// JWTSecret : le MÊME secret que l'API boutique, pour vérifier ses jetons
	// admin tels quels. Un seul compte, une seule connexion, deux services.
	JWTSecret string
	// CollectorToken : secret partagé avec le collecteur Python, qui n'est pas
	// une personne et n'a donc pas de jeton admin.
	CollectorToken string
	// ShopAPIURL : API boutique publique, d'où viennent les packs et prix mis
	// dans le message WhatsApp.
	ShopAPIURL string
	// SiteURL : adresse du site, mise dans le message (avec ses paramètres de
	// campagne).
	SiteURL string
	// CORSOrigins : origines autorisées (le back-office).
	CORSOrigins []string
	// MessageMaxPacks : nombre maximal de packs cités dans le message. Au-delà,
	// le message devient un mur de texte que personne ne lit.
	MessageMaxPacks int
	// Production : active les exigences strictes (secrets obligatoires).
	Production bool
}

// Load construit la configuration depuis l'environnement.
func Load() (Config, error) {
	production := os.Getenv("APP_ENV") == "production"

	cfg := Config{
		Port:        envOr("PORT", "8080"),
		DatabaseURL: os.Getenv("DATABASE_URL"),
		// Les secrets sont copiés-collés d'un hébergeur à l'autre : une espace
		// ou un retour à la ligne parasite ne doit pas les faire diverger.
		JWTSecret:       strings.TrimSpace(os.Getenv("JWT_SECRET")),
		CollectorToken:  strings.TrimSpace(os.Getenv("COLLECTOR_TOKEN")),
		ShopAPIURL:      strings.TrimRight(envOr("SHOP_API_URL", "http://localhost:4000"), "/"),
		SiteURL:         strings.TrimRight(envOr("SITE_URL", "https://plugin-dz.com"), "/"),
		CORSOrigins:     splitList(envOr("CORS_ORIGINS", "http://localhost:3000")),
		MessageMaxPacks: 5,
		Production:      production,
	}

	if raw := os.Getenv("MESSAGE_MAX_PACKS"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 {
			return cfg, fmt.Errorf("MESSAGE_MAX_PACKS doit être un entier >= 1, reçu %q", raw)
		}
		cfg.MessageMaxPacks = n
	}

	if cfg.DatabaseURL == "" {
		return cfg, fmt.Errorf("DATABASE_URL est obligatoire")
	}

	// En dev, mêmes valeurs par défaut que l'API boutique : un jeton obtenu sur
	// /admin/login y est accepté tel quel. En production, aucune valeur par
	// défaut : un secret deviné est un secret nul.
	if cfg.JWTSecret == "" {
		if production {
			return cfg, fmt.Errorf("JWT_SECRET est obligatoire en production")
		}
		cfg.JWTSecret = "dev-secret-local-only"
	}
	if cfg.CollectorToken == "" {
		if production {
			return cfg, fmt.Errorf("COLLECTOR_TOKEN est obligatoire en production")
		}
		cfg.CollectorToken = "dev-collector-token"
	}

	return cfg, nil
}

func envOr(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}

// splitList découpe « a, b ,c » en ["a", "b", "c"], sans entrées vides.
func splitList(raw string) []string {
	var out []string
	for _, part := range strings.Split(raw, ",") {
		if p := strings.TrimSpace(part); p != "" {
			out = append(out, p)
		}
	}
	return out
}
