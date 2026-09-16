import pytest

from collector.normalize import clean_name, normalize_phone


@pytest.mark.parametrize(
    "written",
    [
        "0661234567",
        "06 61 23 45 67",
        "0661.23.45.67",
        "0661-23-45-67",
        "+213661234567",
        "+213 661 23 45 67",
        "00213661234567",
    ],
)
def test_mobile_all_spellings_are_one_number(written):
    phone = normalize_phone(written)
    assert phone is not None, written
    assert phone.e164 == "+213661234567"
    assert phone.national == "0661234567"
    assert phone.is_mobile


def test_landline_is_accepted_but_not_mobile():
    # Une boutique a souvent un fixe : bon pour « Appeler », pas pour WhatsApp.
    phone = normalize_phone("021 45 67 89")
    assert phone is not None
    assert phone.e164 == "+21321456789"
    assert phone.national == "021456789"
    assert not phone.is_mobile


@pytest.mark.parametrize("bad", ["", "   ", None, "+33 6 12 34 56 78", "abc", "0661", "0461234567"])
def test_foreign_or_broken_numbers_are_rejected(bad):
    assert normalize_phone(bad) is None


def test_clean_name_collapses_whitespace():
    assert clean_name("  Espace   Mobile  ") == "Espace Mobile"
    assert clean_name(None) == ""
