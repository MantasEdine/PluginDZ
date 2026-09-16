"""Envoi des prospects au service de prospection (Go).

Le service est le seul propriétaire des données : le collecteur lui remet des
lots et lit ce qu'il en a fait (créés, mis à jour, ignorés). Le jeton partagé
voyage dans un en-tête dédié, distinct du jeton admin des personnes.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable
from typing import Any

import requests

# Signature d'un envoi HTTP : (url, corps JSON, en-têtes) -> (statut, réponse JSON).
Poster = Callable[[str, dict[str, Any], dict[str, str]], tuple[int, dict[str, Any]]]

# Le service refuse au-delà de 500 par lot ; on reste bien en dessous pour que
# chaque lot parte vite et qu'un échec ne coûte pas trop.
DEFAULT_BATCH = 200


class IngestError(RuntimeError):
    """Le service a refusé un lot."""


class IngestClient:
    """Pousse les prospects par lots et cumule le bilan."""

    def __init__(self, base_url: str, token: str, *, post: Poster | None = None) -> None:
        self._url = base_url.rstrip("/") + "/internal/leads"
        self._token = token
        self._post = post or self._http_post
        self._session = requests.Session()

    def _http_post(
        self, url: str, body: dict[str, Any], headers: dict[str, str]
    ) -> tuple[int, dict[str, Any]]:
        response = self._session.post(url, json=body, headers=headers, timeout=60)
        try:
            payload = response.json()
        except ValueError:
            payload = {"error": response.text[:300]}
        return response.status_code, payload

    def send(
        self, leads: Iterable[dict[str, Any]], *, batch_size: int = DEFAULT_BATCH
    ) -> dict[str, Any]:
        """Envoie tous les prospects et renvoie le bilan cumulé."""
        total: dict[str, Any] = {
            "created": 0,
            "updated": 0,
            "skipped": [],
            "warnings": [],
            "batches": 0,
        }
        for batch in _chunks(list(leads), batch_size):
            status, payload = self._post(
                self._url,
                {"leads": batch},
                {"X-Collector-Token": self._token, "Content-Type": "application/json"},
            )
            if status != 200:
                raise IngestError(f"HTTP {status} : {payload.get('error', payload)}")
            data = payload.get("data", {})
            total["created"] += int(data.get("created", 0))
            total["updated"] += int(data.get("updated", 0))
            total["skipped"].extend(data.get("skipped", []))
            total["warnings"].extend(data.get("warnings", []))
            total["batches"] += 1
        return total


def _chunks(items: list[dict[str, Any]], size: int) -> Iterable[list[dict[str, Any]]]:
    for start in range(0, len(items), max(1, size)):
        yield items[start : start + size]
