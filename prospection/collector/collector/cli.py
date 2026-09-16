"""Ligne de commande du collecteur.

    plugin-collect run                       # toutes les wilayas, envoi au service
    plugin-collect run --wilayas Alger Oran  # un sous-ensemble
    plugin-collect run --dry-run             # collecte et affiche, n'envoie rien
    plugin-collect run --fixture pages.json  # sans Google : pages lues d'un fichier
    plugin-collect run --out prospects.json  # garde aussi une copie locale

Variables d'environnement : PLACES_API_KEY, PROSPECTION_API_URL, COLLECTOR_TOKEN.
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
from collections.abc import Iterable
from pathlib import Path
from typing import Any

from .ingest import DEFAULT_BATCH, IngestClient, IngestError
from .places import BudgetExhausted, PlacesClient, PlacesError, place_to_lead
from .plan import build_queries

log = logging.getLogger("collector")

# Plafond d'appels Google par passage. Un passage complet (3 formulations ×
# 69 wilayas × 3 pages) fait au plus ~620 appels ; le quota gratuit mensuel
# du palier facturé est de 1 000. À 700, un passage tient, deux ne passent pas.
DEFAULT_MAX_CALLS = 700


def collect(
    queries: Iterable[tuple[str, str]], client: PlacesClient, *, max_pages: int = 3
) -> list[dict[str, Any]]:
    """Interroge Google pour chaque requête et rend les prospects, sans doublon.

    Une même boutique remonte souvent sur plusieurs formulations (et parfois
    depuis une wilaya voisine) : on ne la garde qu'une fois, à sa première
    apparition — la wilaya de la première requête qui l'a trouvée fait foi.
    """
    seen: set[str] = set()
    leads: list[dict[str, Any]] = []
    for query, wilaya in queries:
        try:
            places = client.search_text(query, max_pages=max_pages)
        except BudgetExhausted as exc:
            # Plafond de coût : on garde ce qu'on a et on n'appelle plus Google.
            log.warning("%s — collecte arrêtée à « %s »", exc, query)
            break
        except PlacesError as exc:
            # Une requête qui échoue ne doit pas faire perdre les 200 autres.
            log.warning("« %s » : %s — requête ignorée", query, exc)
            continue
        fresh = 0
        for place in places:
            lead = place_to_lead(place, fallback_wilaya=wilaya)
            if lead is None or lead["sourceId"] in seen:
                continue
            seen.add(lead["sourceId"])
            leads.append(lead)
            fresh += 1
        log.info("« %s » : %d fiches, %d nouvelles", query, len(places), fresh)
    return leads


def fixture_poster(path: Path):
    """Remplace Google par un fichier : { "requête": [page, …], "*": [page, …] }.

    Les pages d'une requête sont servies dans l'ordre à chaque appel ; la
    clé « * » sert à toute requête absente du fichier.
    """
    data = json.loads(path.read_text(encoding="utf-8"))
    cursors: dict[str, int] = {}

    def post(body: dict[str, Any]) -> dict[str, Any]:
        query = body["textQuery"]
        pages = data.get(query, data.get("*", []))
        index = cursors.get(query, 0)
        cursors[query] = index + 1
        return pages[index] if index < len(pages) else {}

    return post


def _summary(
    leads: list[dict[str, Any]], result: dict[str, Any] | None, *, calls: int, max_calls: int | None
) -> str:
    with_phone = sum(1 for lead in leads if lead["phone"])
    budget = f" sur {max_calls} autorisés" if max_calls is not None else ""
    lines = [
        f"{len(leads)} prospect(s) collecté(s), {with_phone} avec numéro",
        f"{calls} appel(s) Google{budget}",
    ]
    if result is not None:
        lines.append(
            f"service : {result['created']} créé(s), {result['updated']} mis à jour, "
            f"{len(result['skipped'])} ignoré(s), {len(result['warnings'])} avertissement(s)"
        )
        for warning in result["warnings"][:10]:
            lines.append(f"  ! {warning.get('sourceId')} : {warning.get('reason')}")
    return "\n".join(lines)


def run(args: argparse.Namespace) -> int:
    if args.fixture:
        # Le plafond s'applique aussi au fixture : on teste le vrai comportement.
        client = PlacesClient(
            "fixture",
            post=fixture_poster(Path(args.fixture)),
            sleep=lambda _: None,
            max_calls=args.max_calls,
        )
    else:
        api_key = os.environ.get("PLACES_API_KEY", "")
        if not api_key:
            log.error("PLACES_API_KEY manquant (ou utilisez --fixture pour un essai sans Google)")
            return 2
        client = PlacesClient(api_key, max_calls=args.max_calls)

    try:
        queries = build_queries(args.wilayas)
    except ValueError as exc:
        log.error("%s", exc)
        return 2
    log.info("%d requête(s) sur %d wilaya(s)", len(queries), len({w for _, w in queries}))

    leads = collect(queries, client, max_pages=args.max_pages)

    if args.out:
        Path(args.out).write_text(json.dumps(leads, ensure_ascii=False, indent=2), encoding="utf-8")
        log.info("copie écrite : %s", args.out)

    result = None
    if args.dry_run:
        log.info("--dry-run : rien n'est envoyé au service")
    else:
        base_url = os.environ.get("PROSPECTION_API_URL", "")
        token = os.environ.get("COLLECTOR_TOKEN", "")
        if not base_url or not token:
            log.error(
                "PROSPECTION_API_URL et COLLECTOR_TOKEN sont requis pour envoyer (ou --dry-run)"
            )
            return 2
        try:
            result = IngestClient(base_url, token).send(leads, batch_size=args.batch)
        except IngestError as exc:
            log.error("envoi refusé : %s", exc)
            return 1

    print(_summary(leads, result, calls=client.calls, max_calls=client.max_calls))
    return 0


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="plugin-collect", description=__doc__.split("\n\n")[0])
    parser.add_argument("-v", "--verbose", action="store_true", help="journal détaillé")
    sub = parser.add_subparsers(dest="command", required=True)

    p = sub.add_parser("run", help="collecter et envoyer")
    p.add_argument("--wilayas", nargs="+", metavar="WILAYA", help="sous-ensemble (défaut : les 69)")
    p.add_argument("--max-pages", type=int, default=3, help="pages Google par requête (1–3)")
    p.add_argument(
        "--max-calls",
        type=int,
        default=DEFAULT_MAX_CALLS,
        help=f"appels Google au plus par passage, le plafond de coût (défaut {DEFAULT_MAX_CALLS})",
    )
    p.add_argument("--dry-run", action="store_true", help="collecter sans envoyer")
    p.add_argument("--fixture", metavar="FICHIER", help="pages Google lues d'un JSON, sans réseau")
    p.add_argument("--out", metavar="FICHIER", help="écrire les prospects collectés en JSON")
    p.add_argument("--batch", type=int, default=DEFAULT_BATCH, help="taille des lots envoyés")
    p.set_defaults(func=run)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(levelname)s %(message)s",
        stream=sys.stderr,
    )
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
