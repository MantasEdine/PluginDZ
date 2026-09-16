// Point d'entrée du service de prospection.
//
// Assemble la configuration, la base, le client boutique et le serveur HTTP,
// puis s'arrête proprement sur SIGTERM : les requêtes en cours se terminent,
// le pool Postgres se ferme, et l'hébergeur peut redéployer sans couper une
// écriture au milieu.
package main

import (
	"context"
	"errors"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/MantasEdine/PluginDZ/prospection/api/internal/config"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/httpapi"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/shop"
	"github.com/MantasEdine/PluginDZ/prospection/api/internal/store"
)

func main() {
	log.SetFlags(log.LstdFlags | log.Lmsgprefix)
	log.SetPrefix("[prospection] ")

	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("configuration : %v", err)
	}

	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	db, err := store.NewPostgres(ctx, cfg.DatabaseURL)
	if err != nil {
		log.Fatalf("base : %v", err)
	}
	defer db.Close()

	// Une minute de cache : un pack ajouté ou modifié au back-office est cité
	// dans le message suivant presque tout de suite, sans appeler la boutique
	// à chaque clic.
	packs := shop.New(cfg.ShopAPIURL, time.Minute)
	api := httpapi.New(cfg, db, packs, time.Now)

	srv := &http.Server{
		Addr:              ":" + cfg.Port,
		Handler:           api.Handler(),
		ReadHeaderTimeout: 10 * time.Second,
		ReadTimeout:       30 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       120 * time.Second,
	}

	go func() {
		log.Printf("API démarrée sur http://localhost:%s (boutique : %s)", cfg.Port, cfg.ShopAPIURL)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			log.Fatalf("serveur HTTP : %v", err)
		}
	}()

	<-ctx.Done()
	log.Print("arrêt demandé, fin des requêtes en cours…")
	shutdownCtx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		log.Printf("arrêt forcé : %v", err)
		os.Exit(1)
	}
}
