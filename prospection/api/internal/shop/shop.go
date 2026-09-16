// Package shop lit les offres de la boutique, pour les citer dans le message.
//
// Une seule source de vérité pour les prix : l'API publique de la boutique.
// Rien n'est recopié ici — quand un pack change de prix au back-office, le
// prochain message le cite juste. Un cache court évite d'appeler la boutique à
// chaque clic sans jamais servir un prix vieux de plus de quelques minutes.
package shop

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"sync"
	"time"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/message"
)

// Client lit /api/packs et garde le résultat un moment.
type Client struct {
	baseURL string
	http    *http.Client
	ttl     time.Duration

	mu        sync.Mutex
	cached    []message.Pack
	fetchedAt time.Time
}

// New crée un client sur l'API boutique (URL sans barre finale).
func New(baseURL string, ttl time.Duration) *Client {
	return &Client{
		baseURL: baseURL,
		http:    &http.Client{Timeout: 8 * time.Second},
		ttl:     ttl,
	}
}

// Packs renvoie les packs actifs en stock, les mis en avant d'abord puis par
// prix croissant — l'ordre dans lequel on veut les lire dans un message court.
//
// Si la boutique ne répond pas, on rend le dernier résultat connu plutôt
// qu'une erreur : un message sans packs à jour vaut mieux qu'un bouton mort.
func (c *Client) Packs(ctx context.Context) ([]message.Pack, error) {
	c.mu.Lock()
	if c.cached != nil && time.Since(c.fetchedAt) < c.ttl {
		defer c.mu.Unlock()
		return c.cached, nil
	}
	c.mu.Unlock()

	fresh, err := c.fetch(ctx)
	c.mu.Lock()
	defer c.mu.Unlock()
	if err != nil {
		if c.cached != nil {
			return c.cached, nil
		}
		return nil, err
	}
	c.cached, c.fetchedAt = fresh, time.Now()
	return fresh, nil
}

// apiPack est la partie du JSON boutique qui nous intéresse.
type apiPack struct {
	message.Pack
	Stock    int  `json:"stock"`
	IsActive bool `json:"isActive"`
}

func (c *Client) fetch(ctx context.Context) ([]message.Pack, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.baseURL+"/api/packs", nil)
	if err != nil {
		return nil, err
	}
	res, err := c.http.Do(req)
	if err != nil {
		return nil, fmt.Errorf("API boutique injoignable : %w", err)
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("API boutique : HTTP %d", res.StatusCode)
	}

	var body struct {
		Data []apiPack `json:"data"`
	}
	if err := json.NewDecoder(res.Body).Decode(&body); err != nil {
		return nil, fmt.Errorf("réponse boutique illisible : %w", err)
	}

	packs := make([]message.Pack, 0, len(body.Data))
	for _, p := range body.Data {
		// On ne propose que ce qui peut être commandé aujourd'hui.
		if p.IsActive && p.Stock > 0 {
			packs = append(packs, p.Pack)
		}
	}
	sort.SliceStable(packs, func(i, j int) bool {
		if packs[i].IsFeatured != packs[j].IsFeatured {
			return packs[i].IsFeatured
		}
		return packs[i].Price < packs[j].Price
	})
	return packs, nil
}
