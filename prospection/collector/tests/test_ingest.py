import pytest

from collector.ingest import IngestClient, IngestError


def make_client(responses, *, sent=None):
    """Client dont le réseau est remplacé : `responses` est la file des (statut, JSON)."""
    sent = sent if sent is not None else []
    queue = list(responses)

    def post(url, body, headers):
        sent.append((url, body, headers))
        return queue.pop(0)

    return IngestClient("http://prospection.local/", "jeton-collecteur", post=post), sent


def test_sends_batches_with_token_and_sums_results():
    ok = (200, {"data": {"created": 2, "updated": 1, "skipped": [], "warnings": []}})
    ok2 = (
        200,
        {
            "data": {
                "created": 1,
                "updated": 0,
                "skipped": [{"sourceId": "z", "reason": "x"}],
                "warnings": [{"sourceId": "y", "reason": "num"}],
            }
        },
    )
    client, sent = make_client([ok, ok2])

    leads = [{"sourceId": str(i)} for i in range(5)]
    result = client.send(leads, batch_size=3)

    assert result["batches"] == 2
    assert result["created"] == 3 and result["updated"] == 1
    assert len(result["skipped"]) == 1 and len(result["warnings"]) == 1
    assert [len(body["leads"]) for _, body, _ in sent] == [3, 2]
    url, _, headers = sent[0]
    assert url == "http://prospection.local/internal/leads"
    assert headers["X-Collector-Token"] == "jeton-collecteur"


def test_refusal_raises_with_reason():
    client, _ = make_client([(401, {"error": "Jeton collecteur invalide"})])
    with pytest.raises(IngestError, match="401.*Jeton collecteur invalide"):
        client.send([{"sourceId": "1"}])


def test_empty_input_sends_nothing():
    client, sent = make_client([])
    result = client.send([])
    assert result["batches"] == 0 and sent == []
