"""Nettoyage de ce que Google renvoie, avant envoi au service.

Le service (Go) refait sa propre normalisation des numéros — c'est lui qui
décide. Ici on filtre en amont ce qui n'est manifestement pas un numéro
algérien joignable, pour ne pas lui envoyer du bruit, et on apprend au
collecteur à distinguer un mobile d'un fixe : seul un mobile a WhatsApp.
"""

from __future__ import annotations

from dataclasses import dataclass

import phonenumbers
from phonenumbers import PhoneNumberType

_MOBILE_TYPES = {PhoneNumberType.MOBILE, PhoneNumberType.FIXED_LINE_OR_MOBILE}


@dataclass(frozen=True)
class Phone:
    """Un numéro algérien sous ses deux formes utiles."""

    e164: str  # +213661234567 — la forme que le service enregistre
    national: str  # 0661234567 — celle que le gérant lit
    is_mobile: bool


def normalize_phone(raw: str | None) -> Phone | None:
    """Ramène un numéro à une forme unique, ou None s'il n'est pas algérien.

    « +213 21 45 67 89 », « 021456789 », « 0661-23-45-67 » sont acceptés ;
    un numéro étranger ou incomplet est rejeté — on ne veut pas d'un bouton
    « Appeler » qui compose un mauvais numéro.
    """
    if not raw or not raw.strip():
        return None
    try:
        parsed = phonenumbers.parse(raw, "DZ")
    except phonenumbers.NumberParseException:
        return None
    if parsed.country_code != 213 or not phonenumbers.is_valid_number(parsed):
        return None

    e164 = phonenumbers.format_number(parsed, phonenumbers.PhoneNumberFormat.E164)
    national = "0" + str(parsed.national_number)
    return Phone(
        e164=e164,
        national=national,
        is_mobile=phonenumbers.number_type(parsed) in _MOBILE_TYPES,
    )


def clean_name(raw: str | None) -> str:
    """Espaces normalisés, sans décoration — le nom tel qu'on l'écrira dans le message."""
    return " ".join((raw or "").split())
