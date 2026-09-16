"""Le plan de recherche : quelles requêtes poser à Google, et pour quelle wilaya.

Trois formulations par wilaya — en français commerçant, en français produit,
et en arabe — parce que les fiches Google sont rédigées dans la langue du
gérant, et qu'une boutique nommée « محل الهاتف » ne remonte pas sur
« accessoires téléphone ».

Ordre de grandeur : 3 formulations × 69 wilayas × 3 pages au plus ≈ 600 appels
pour un passage complet. C'est le budget à garder en tête pour la facture Google.
"""

from __future__ import annotations

from collections.abc import Iterable

from .wilayas import WILAYAS, canonical

TEMPLATES: tuple[str, ...] = (
    "magasin accessoires téléphone {wilaya}",
    "chargeur téléphone boutique {wilaya}",
    "محل اكسسوارات هاتف {wilaya}",
)


def build_queries(
    wilayas: Iterable[str] | None = None,
    templates: Iterable[str] = TEMPLATES,
) -> list[tuple[str, str]]:
    """Renvoie des paires (requête, wilaya canonique), dans l'ordre des wilayas.

    Une wilaya inconnue lève une erreur tout de suite : mieux vaut un plan
    refusé qu'une journée de collecte sur « Alger » mal orthographié.
    """
    chosen = list(WILAYAS) if wilayas is None else [_require(w) for w in wilayas]
    return [(t.format(wilaya=w), w) for w in chosen for t in templates]


def _require(name: str) -> str:
    found = canonical(name)
    if not found:
        raise ValueError(f"wilaya inconnue : {name!r}")
    return found
