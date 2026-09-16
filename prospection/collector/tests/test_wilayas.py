import pytest

from collector.wilayas import WILAYAS, canonical, detect_wilaya, fold


def test_sixty_nine_wilayas_without_duplicates():
    assert len(WILAYAS) == 69
    assert len(set(WILAYAS)) == 69
    assert WILAYAS[15] == "Alger" and WILAYAS[-1] == "El Abiodh Sidi Cheikh"


@pytest.mark.parametrize(
    ("written", "expected"),
    [
        ("Alger", "Alger"),
        ("ALGER", "Alger"),
        ("Wilaya d'Alger", "Alger"),
        ("Wilaya d’Alger", "Alger"),
        ("Algiers", "Alger"),
        ("ولاية الجزائر", "Alger"),
        ("Bejaia", "Béjaïa"),
        ("Béjaïa", "Béjaïa"),
        ("wilaya de Sétif", "Sétif"),
        ("setif", "Sétif"),
        ("وهران", "Oran"),
        ("Sidi Bel Abbes", "Sidi Bel Abbès"),
        ("Bou Saada", "Bou Saâda"),
        ("El Abiodh Sidi Cheikh", "El Abiodh Sidi Cheikh"),
    ],
)
def test_canonical_folds_spellings(written, expected):
    assert canonical(written) == expected


@pytest.mark.parametrize("unknown", ["Paris", "", None, "Wilaya inventée"])
def test_canonical_rejects_unknown(unknown):
    assert canonical(unknown) is None


def test_fold_removes_accents_prefix_and_case():
    assert fold("  Wilaya de  BÉJAÏA ") == "bejaia"


def test_detect_prefers_administrative_component():
    components = [
        {"longText": "Alger Centre", "types": ["locality"]},
        {
            "longText": "Wilaya d'Alger",
            "shortText": "Alger",
            "types": ["administrative_area_level_1"],
        },
    ]
    # L'adresse dit Oran, le composant dit Alger : le composant gagne.
    assert detect_wilaya(components, "Oran, Algérie", "Constantine") == "Alger"


def test_detect_falls_back_to_address_then_query():
    assert detect_wilaya(None, "Boulevard de l'ALN, 31000 Oran, Algérie", "Alger") == "Oran"
    assert detect_wilaya([], "Quelque part, Algérie", "Blida") == "Blida"
    assert detect_wilaya([], None, None) is None


def test_detect_reads_arabic_component():
    components = [
        {"longText": "ولاية وهران", "shortText": "وهران", "types": ["administrative_area_level_1"]}
    ]
    assert detect_wilaya(components, None, None) == "Oran"
