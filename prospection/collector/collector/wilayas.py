"""Les 69 wilayas, et comment retrouver la bonne dans une adresse Google.

Google écrit la wilaya de plusieurs façons — « Alger », « Wilaya d'Alger »,
« Algiers », « ولاية الجزائر ». On replie tout (accents, casse, préfixes) sur
un nom canonique, le même que celui du formulaire de commande de la boutique,
pour que les filtres du back-office parlent la même langue que le site.
"""

from __future__ import annotations

import re
import unicodedata

# Ordre officiel des codes : 1–48 historiques, 49–58 loi 19-12, 59–69 loi 26-06.
WILAYAS: tuple[str, ...] = (
    "Adrar",
    "Chlef",
    "Laghouat",
    "Oum El Bouaghi",
    "Batna",
    "Béjaïa",
    "Biskra",
    "Béchar",
    "Blida",
    "Bouira",
    "Tamanrasset",
    "Tébessa",
    "Tlemcen",
    "Tiaret",
    "Tizi Ouzou",
    "Alger",
    "Djelfa",
    "Jijel",
    "Sétif",
    "Saïda",
    "Skikda",
    "Sidi Bel Abbès",
    "Annaba",
    "Guelma",
    "Constantine",
    "Médéa",
    "Mostaganem",
    "M'Sila",
    "Mascara",
    "Ouargla",
    "Oran",
    "El Bayadh",
    "Illizi",
    "Bordj Bou Arreridj",
    "Boumerdès",
    "El Tarf",
    "Tindouf",
    "Tissemsilt",
    "El Oued",
    "Khenchela",
    "Souk Ahras",
    "Tipaza",
    "Mila",
    "Aïn Defla",
    "Naâma",
    "Aïn Témouchent",
    "Ghardaïa",
    "Relizane",
    "Timimoun",
    "Bordj Badji Mokhtar",
    "Ouled Djellal",
    "Béni Abbès",
    "In Salah",
    "In Guezzam",
    "Touggourt",
    "Djanet",
    "El M'Ghair",
    "El Meniaa",
    "Aflou",
    "Barika",
    "El Kantara",
    "Bir El Ater",
    "El Aricha",
    "Ksar Chellala",
    "Aïn Oussara",
    "Messaad",
    "Ksar El Boukhari",
    "Bou Saâda",
    "El Abiodh Sidi Cheikh",
)

# Autres écritures courantes (anglais, arabe, variantes) → nom canonique.
# Les 69 noms français se reconnaissent d'eux-mêmes après repli ; ceci ne couvre
# que ce qui s'écrit autrement. Une wilaya absente d'ici n'est pas perdue : la
# wilaya de la requête sert de repli.
_ALIASES: dict[str, str] = {
    "algiers": "Alger",
    "الجزائر": "Alger",
    "الجزائر العاصمة": "Alger",
    "وهران": "Oran",
    "قسنطينة": "Constantine",
    "عنابة": "Annaba",
    "البليدة": "Blida",
    "سطيف": "Sétif",
    "باتنة": "Batna",
    "تلمسان": "Tlemcen",
    "بجاية": "Béjaïa",
    "تيزي وزو": "Tizi Ouzou",
    "الشلف": "Chlef",
    "سكيكدة": "Skikda",
    "مستغانم": "Mostaganem",
    "بومرداس": "Boumerdès",
    "تيبازة": "Tipaza",
    "المدية": "Médéa",
    "الجلفة": "Djelfa",
    "بسكرة": "Biskra",
    "ورقلة": "Ouargla",
    "غرداية": "Ghardaïa",
    "بشار": "Béchar",
    "تبسة": "Tébessa",
    "جيجل": "Jijel",
    "سيدي بلعباس": "Sidi Bel Abbès",
    "معسكر": "Mascara",
    "المسيلة": "M'Sila",
    "برج بوعريريج": "Bordj Bou Arreridj",
    "الوادي": "El Oued",
    "بويرة": "Bouira",
    "البويرة": "Bouira",
    "تيارت": "Tiaret",
    "غليزان": "Relizane",
    "سعيدة": "Saïda",
    "قالمة": "Guelma",
    "ميلة": "Mila",
    "خنشلة": "Khenchela",
    "سوق أهراس": "Souk Ahras",
    "الطارف": "El Tarf",
    "عين الدفلى": "Aïn Defla",
    "عين تموشنت": "Aïn Témouchent",
    "أم البواقي": "Oum El Bouaghi",
    "الأغواط": "Laghouat",
    "تمنراست": "Tamanrasset",
    "أدرار": "Adrar",
    "النعامة": "Naâma",
    "البيض": "El Bayadh",
    "تندوف": "Tindouf",
    "تيسمسيلت": "Tissemsilt",
    "إليزي": "Illizi",
    "تقرت": "Touggourt",
    "المنيعة": "El Meniaa",
    "المغير": "El M'Ghair",
    "جانت": "Djanet",
    "bejaia": "Béjaïa",
    "setif": "Sétif",
    "bechar": "Béchar",
    "tebessa": "Tébessa",
    "medea": "Médéa",
    "boumerdes": "Boumerdès",
    "ghardaia": "Ghardaïa",
    "saida": "Saïda",
    "ain defla": "Aïn Defla",
    "ain temouchent": "Aïn Témouchent",
    "naama": "Naâma",
    "sidi bel abbes": "Sidi Bel Abbès",
    "beni abbes": "Béni Abbès",
    "bou saada": "Bou Saâda",
    "ain oussara": "Aïn Oussara",
    "msila": "M'Sila",
    "m'sila": "M'Sila",
    "el mghair": "El M'Ghair",
}

_PREFIXES = re.compile(
    r"^(wilaya\s+(?:d['’]|de\s+|des\s+)?|province\s+(?:d['’]|de\s+)?|ولاية\s+)", re.IGNORECASE
)


def fold(text: str) -> str:
    """Replie une écriture : sans accents, en minuscules, sans préfixe « Wilaya de »."""
    text = _PREFIXES.sub("", text.strip())
    decomposed = unicodedata.normalize("NFD", text)
    stripped = "".join(ch for ch in decomposed if not unicodedata.combining(ch))
    return re.sub(r"\s+", " ", stripped).strip().lower()


# Index de repli : écriture repliée → nom canonique.
_INDEX: dict[str, str] = {fold(name): name for name in WILAYAS}
_INDEX.update({fold(alias): name for alias, name in _ALIASES.items()})


def canonical(name: str | None) -> str | None:
    """Renvoie le nom canonique d'une wilaya, ou None si non reconnue."""
    if not name:
        return None
    return _INDEX.get(fold(name))


def detect_wilaya(
    address_components: list[dict] | None,
    formatted_address: str | None,
    fallback: str | None,
) -> str | None:
    """Trouve la wilaya d'une fiche Google.

    Dans l'ordre : le composant administratif de niveau 1 (le plus fiable),
    puis chaque morceau de l'adresse formatée, puis la wilaya de la requête
    qui a ramené la fiche — on cherchait bien « … à Oran ».
    """
    for component in address_components or []:
        if "administrative_area_level_1" in component.get("types", []):
            for key in ("longText", "shortText"):
                if found := canonical(component.get(key)):
                    return found

    if formatted_address:
        for part in formatted_address.split(","):
            # « 16000 Alger » → on retire le code postal éventuel.
            part = re.sub(r"^\s*\d{4,5}\s+", "", part)
            if found := canonical(part):
                return found

    return canonical(fallback)
