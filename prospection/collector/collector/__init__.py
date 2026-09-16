"""Collecteur de prospects pour Plugin.dz.

Interroge Google Places pour trouver les boutiques d'accessoires téléphone
wilaya par wilaya, nettoie ce qui revient (numéros, wilaya), et envoie le tout
au service de prospection (Go), qui en est le seul propriétaire.

Le collecteur n'écrit jamais en base et n'envoie jamais de message : il
ramène des fiches, rien d'autre.
"""

__all__ = ["__version__"]
__version__ = "0.1.0"
