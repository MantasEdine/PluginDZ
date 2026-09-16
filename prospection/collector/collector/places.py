"""Client Google Places (API « New », recherche textuelle).

Une requête comme « magasin accessoires téléphone Oran » rend jusqu'à 20
fiches par page, trois pages au plus. On ne demande que les champs qu'on
utilise (le masque de champs) : c'est ce qui fixe le tarif de l'appel.

L'accès réseau est injectable (`post`) : les tests, et le mode `--fixture`
du collecteur, remplacent Google par un fichier JSON.
"""

from __future__ import annotations

import time
from collections.abc import Callable
from typing import Any

import requests

from .normalize import clean_name, normalize_phone
from .wilayas import detect_wilaya

ENDPOINT = "https://places.googleapis.com/v1/places:searchText"

# Ce qu'on demande à Google — rien de plus, chaque champ est facturé.
FIELD_MASK = ",".join(
    [
        "places.id",
        "places.displayName",
        "places.formattedAddress",
        "places.addressComponents",
        "places.nationalPhoneNumber",
        "places.internationalPhoneNumber",
        "places.location",
        "places.googleMapsUri",
        "places.websiteUri",
        "places.rating",
        "places.userRatingCount",
        "places.businessStatus",
        "nextPageToken",
    ]
)

SOURCE = "google_places"

# Signature d'un envoi HTTP : (corps JSON) -> réponse JSON.
Poster = Callable[[dict[str, Any]], dict[str, Any]]


class PlacesError(RuntimeError):
    """Google a refusé ou n'a pas répondu."""


class BudgetExhausted(PlacesError):
    """Le nombre d'appels autorisés pour ce passage est atteint.

    C'est le plafond de coût du collecteur, tenu par le code lui-même :
    Google ne laisse pas toujours abaisser ses quotas (compte en essai), et
    chaque appel est facturé. Quand il est atteint, on s'arrête net — les
    fiches déjà obtenues sont conservées et envoyées.
    """


class PlacesClient:
    """Recherche textuelle paginée, restreinte à l'Algérie et en français."""

    def __init__(
        self,
        api_key: str,
        *,
        post: Poster | None = None,
        language: str = "fr",
        region: str = "DZ",
        page_delay: float = 1.0,
        sleep: Callable[[float], None] = time.sleep,
        max_calls: int | None = None,
    ) -> None:
        self._post = post or self._http_post
        self._api_key = api_key
        self._language = language
        self._region = region
        self._page_delay = page_delay
        self._sleep = sleep
        self._max_calls = max_calls
        self._session = requests.Session()
        # Appels réellement partis vers Google (une page = un appel facturé).
        self.calls = 0

    @property
    def max_calls(self) -> int | None:
        return self._max_calls

    def _http_post(self, body: dict[str, Any]) -> dict[str, Any]:
        response = self._session.post(
            ENDPOINT,
            json=body,
            headers={
                "X-Goog-Api-Key": self._api_key,
                "X-Goog-FieldMask": FIELD_MASK,
                "Content-Type": "application/json",
            },
            timeout=20,
        )
        if response.status_code != 200:
            raise PlacesError(f"HTTP {response.status_code} : {response.text[:300]}")
        return response.json()

    def search_text(self, query: str, *, max_pages: int = 3) -> list[dict[str, Any]]:
        """Toutes les fiches d'une requête, pages suivantes comprises."""
        places: list[dict[str, Any]] = []
        token: str | None = None
        for page in range(max_pages):
            body: dict[str, Any] = {
                "textQuery": query,
                "languageCode": self._language,
                "regionCode": self._region,
                "pageSize": 20,
            }
            if token:
                body["pageToken"] = token
            if self._max_calls is not None and self.calls >= self._max_calls:
                raise BudgetExhausted(f"{self.calls} appel(s) Google : plafond --max-calls atteint")
            self.calls += 1
            data = self._post(body)
            places.extend(data.get("places", []))
            token = data.get("nextPageToken")
            if not token:
                break
            # Google demande un court délai avant de servir la page suivante.
            if page < max_pages - 1:
                self._sleep(self._page_delay)
        return places


def place_to_lead(place: dict[str, Any], *, fallback_wilaya: str | None) -> dict[str, Any] | None:
    """Traduit une fiche Google en prospect à envoyer au service.

    Renvoie None pour une fiche sans identifiant, sans nom, ou fermée
    définitivement : rien à prospecter là.
    """
    place_id = place.get("id")
    name = clean_name((place.get("displayName") or {}).get("text"))
    if not place_id or not name:
        return None
    if place.get("businessStatus") == "CLOSED_PERMANENTLY":
        return None

    phone = normalize_phone(
        place.get("internationalPhoneNumber") or place.get("nationalPhoneNumber")
    )
    location = place.get("location") or {}
    rating_count = place.get("userRatingCount")

    return {
        "source": SOURCE,
        "sourceId": place_id,
        "name": name,
        # Le service renormalise ; on lui envoie la forme E.164 quand on l'a,
        # sinon la chaîne brute pour qu'il décide (et signale) lui-même.
        "phone": phone.e164 if phone else (place.get("nationalPhoneNumber") or ""),
        "address": place.get("formattedAddress") or "",
        "wilaya": detect_wilaya(
            place.get("addressComponents"), place.get("formattedAddress"), fallback_wilaya
        )
        or "",
        "lat": location.get("latitude"),
        "lng": location.get("longitude"),
        "mapsUrl": place.get("googleMapsUri") or "",
        "website": place.get("websiteUri") or "",
        "rating": place.get("rating"),
        "ratingCount": int(rating_count) if rating_count is not None else None,
    }
