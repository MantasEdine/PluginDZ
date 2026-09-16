import json
from pathlib import Path

import pytest

from collector.places import (
    FIELD_MASK,
    BudgetExhausted,
    PlacesClient,
    PlacesError,
    is_excluded,
    place_to_lead,
)

FIXTURE = Path(__file__).parent / "fixtures" / "places_page.json"


@pytest.fixture
def pages():
    return json.loads(FIXTURE.read_text(encoding="utf-8"))["*"]


def make_client(pages, *, calls=None):
    """Client dont le réseau est remplacé par les pages du fixture, dans l'ordre."""
    calls = calls if calls is not None else []

    def post(body):
        calls.append(body)
        return pages[len(calls) - 1] if len(calls) - 1 < len(pages) else {}

    return PlacesClient("clé-de-test", post=post, sleep=lambda _: None), calls


def test_search_follows_pagination(pages):
    client, calls = make_client(pages)
    places = client.search_text("magasin accessoires téléphone Alger")
    assert (
        len(places) == 9
    )  # 6 sur la première page, 3 sur la seconde (bijouteries incluses : le filtre est plus loin)
    assert len(calls) == 2
    assert "pageToken" not in calls[0]
    assert calls[1]["pageToken"] == "page-2"
    # Chaque appel répète la requête et la restriction à l'Algérie.
    for body in calls:
        assert body["textQuery"] == "magasin accessoires téléphone Alger"
        assert body["regionCode"] == "DZ" and body["languageCode"] == "fr"


def test_search_respects_max_pages(pages):
    client, calls = make_client(pages)
    assert len(client.search_text("x", max_pages=1)) == 6
    assert len(calls) == 1


def test_field_mask_only_asks_what_we_use():
    # Chaque champ demandé est facturé : on vérifie qu'on ne dérive pas.
    fields = set(FIELD_MASK.split(","))
    assert "places.id" in fields and "places.nationalPhoneNumber" in fields
    assert not any("reviews" in f or "photos" in f or "openingHours" in f for f in fields)


def test_http_error_is_reported():
    def post(_body):
        raise PlacesError("HTTP 403 : clé refusée")

    client = PlacesClient("clé", post=post, sleep=lambda _: None)
    with pytest.raises(PlacesError):
        client.search_text("x")


def test_place_to_lead_mobile(pages):
    place = pages[0]["places"][0]
    lead = place_to_lead(place, fallback_wilaya="Blida")
    assert lead["sourceId"] == "ChIJ-alger-nour"
    assert lead["name"] == "محل النور للهواتف"
    assert lead["phone"] == "+213661234567"
    assert lead["wilaya"] == "Alger"  # composant administratif, pas le repli
    assert lead["lat"] == pytest.approx(36.7538)
    assert lead["rating"] == 4.6 and lead["ratingCount"] == 132
    assert lead["website"] == "https://example.dz/nour"


def test_place_to_lead_landline_and_missing_fields(pages):
    fixe = place_to_lead(pages[0]["places"][1], fallback_wilaya=None)
    assert fixe["phone"] == "+21321456789"

    sans_tel = place_to_lead(pages[0]["places"][2], fallback_wilaya="Alger")
    assert sans_tel["name"] == "Espace Mobile"  # espaces nettoyés
    assert sans_tel["phone"] == ""
    assert sans_tel["rating"] is None and sans_tel["ratingCount"] is None
    assert sans_tel["wilaya"] == "Alger"  # lu dans l'adresse formatée


def test_place_to_lead_drops_closed_and_keeps_foreign_phone_raw(pages):
    assert place_to_lead(pages[0]["places"][3], fallback_wilaya="Alger") is None  # fermé
    etranger = place_to_lead(pages[0]["places"][4], fallback_wilaya="Alger")
    # Non reconnu ici : on transmet la chaîne brute, le service signalera.
    assert etranger["phone"] == "+33 6 12 34 56 78"


def test_place_to_lead_arabic_component(pages):
    oran = place_to_lead(pages[1]["places"][1], fallback_wilaya="Alger")
    assert oran["wilaya"] == "Oran"
    assert oran["phone"] == "+213770112233"


def test_place_to_lead_rejects_unusable():
    assert place_to_lead({}, fallback_wilaya=None) is None
    assert place_to_lead({"id": "x", "displayName": {"text": "   "}}, fallback_wilaya=None) is None


def test_budget_counts_every_page_and_stops_before_the_next_call(pages):
    calls = []

    def post(body):
        calls.append(body)
        return pages[len(calls) - 1] if len(calls) - 1 < len(pages) else {}

    client = PlacesClient("clé", post=post, sleep=lambda _: None, max_calls=2)
    # Le fixture a 2 pages : la 1re requête consomme tout le budget.
    first = client.search_text("magasin accessoires téléphone Alger")
    assert len(first) > 0
    assert client.calls == 2
    # La suivante ne doit pas partir : aucun appel de plus, erreur dédiée.
    with pytest.raises(BudgetExhausted):
        client.search_text("magasin accessoires téléphone Oran")
    assert len(calls) == 2
    assert isinstance(BudgetExhausted("x"), PlacesError)


def test_budget_none_means_unlimited(pages):
    client, calls = make_client(pages)
    for _ in range(5):
        client.search_text("q", max_pages=1)
    assert client.calls == 5 == len(calls)


def test_jewelry_is_excluded_by_type_and_by_name(pages):
    # Type Google explicite, même si le nom dit « accessoires ».
    assert place_to_lead(pages[0]["places"][5], fallback_wilaya="Alger") is None
    # Pas de type utile : le nom arabe suffit.
    assert place_to_lead(pages[1]["places"][2], fallback_wilaya="Oran") is None
    # Une boutique de téléphonie reste acceptée.
    assert place_to_lead(pages[0]["places"][0], fallback_wilaya="Alger") is not None


def test_is_excluded_cases():
    assert is_excluded("Bijouterie El Nour", None)
    assert is_excluded("JOAILLERIE Royale", ["store"])
    assert is_excluded("Sam's Jewellery", [])
    assert is_excluded("محل الذهب", None)
    assert is_excluded("Accessoires Mode", ["jewelry_store"])
    assert is_excluded("Montres & Co", ["watch_store"])
    assert not is_excluded("Phone Accessoires Bab El Oued", ["electronics_store"])
    assert not is_excluded("محل النور للهواتف", None)
    # « or » seul n'est pas un mot-clé : trop de noms le contiennent.
    assert not is_excluded("Oran Tech Accessoires", ["store"])
