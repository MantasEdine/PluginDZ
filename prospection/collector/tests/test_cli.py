import json
from pathlib import Path

from collector import cli
from collector.places import PlacesClient
from collector.plan import build_queries

FIXTURE = Path(__file__).parent / "fixtures" / "places_page.json"


def test_build_queries_default_and_subset():
    assert len(build_queries()) == 69 * 3
    subset = build_queries(["alger", "Wilaya d'Oran"])
    assert [w for _, w in subset] == ["Alger"] * 3 + ["Oran"] * 3
    assert subset[0][0] == "magasin accessoires téléphone Alger"
    assert any("محل" in q for q, _ in subset)


def test_build_queries_refuses_unknown_wilaya():
    try:
        build_queries(["Atlantide"])
    except ValueError as exc:
        assert "Atlantide" in str(exc)
    else:
        raise AssertionError("une wilaya inconnue doit être refusée")


def test_collect_dedupes_across_queries_and_pages():
    client = PlacesClient("x", post=cli.fixture_poster(FIXTURE), sleep=lambda _: None)
    queries = build_queries(["Alger"])  # 3 formulations, même fixture pour chacune
    leads = cli.collect(queries, client)
    ids = [lead["sourceId"] for lead in leads]
    # 7 fiches × 3 requêtes, mais : une fermée, un doublon en page 2, et les
    # mêmes fiches à chaque formulation → 5 prospects distincts.
    assert len(ids) == len(set(ids)) == 5
    assert "ChIJ-alger-ferme" not in ids
    by_id = {lead["sourceId"]: lead for lead in leads}
    assert by_id["ChIJ-oran-tech"]["wilaya"] == "Oran"  # lu dans la fiche, pas le repli
    assert by_id["ChIJ-alger-sans-tel"]["wilaya"] == "Alger"


def test_run_dry_run_with_fixture_writes_out_file(tmp_path, capsys, monkeypatch):
    monkeypatch.delenv("PLACES_API_KEY", raising=False)
    out = tmp_path / "prospects.json"
    code = cli.main(
        ["run", "--wilayas", "Alger", "--fixture", str(FIXTURE), "--dry-run", "--out", str(out)]
    )
    assert code == 0
    written = json.loads(out.read_text(encoding="utf-8"))
    assert len(written) == 5
    assert "5 prospect(s) collecté(s), 4 avec numéro" in capsys.readouterr().out


def test_run_without_key_or_fixture_fails_clearly(monkeypatch):
    monkeypatch.delenv("PLACES_API_KEY", raising=False)
    assert cli.main(["run", "--wilayas", "Alger"]) == 2


def test_run_sends_to_service(monkeypatch):
    sent = []

    class FakeIngest:
        def __init__(self, base_url, token):
            sent.append((base_url, token))

        def send(self, leads, batch_size):
            sent.append(len(list(leads)))
            return {"created": 5, "updated": 0, "skipped": [], "warnings": [], "batches": 1}

    monkeypatch.setattr(cli, "IngestClient", FakeIngest)
    monkeypatch.setenv("PROSPECTION_API_URL", "http://prospection.local")
    monkeypatch.setenv("COLLECTOR_TOKEN", "secret")
    assert cli.main(["run", "--wilayas", "Alger", "--fixture", str(FIXTURE)]) == 0
    assert sent == [("http://prospection.local", "secret"), 5]


def test_run_refuses_to_send_without_service_config(monkeypatch):
    monkeypatch.delenv("PROSPECTION_API_URL", raising=False)
    monkeypatch.delenv("COLLECTOR_TOKEN", raising=False)
    assert cli.main(["run", "--wilayas", "Alger", "--fixture", str(FIXTURE)]) == 2
