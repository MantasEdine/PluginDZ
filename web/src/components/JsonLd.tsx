/**
 * Données structurées (schema.org, format JSON-LD).
 *
 * C'est ce qui permet à Google d'afficher le prix et la disponibilité directement
 * dans les résultats de recherche, au lieu d'un simple lien bleu. Bing et
 * DuckDuckGo lisent le même format.
 *
 * Composant serveur : le balisage part dans le HTML initial, donc les robots le
 * voient sans exécuter de JavaScript.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      // Le contenu vient de notre API, pas d'une saisie visiteur. On échappe malgré
      // tout `<` pour qu'une description ne puisse jamais fermer la balise script.
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
    />
  );
}
