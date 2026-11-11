"""Smoke tests: each sample input must produce the documented gating decision."""
import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)
SAMPLES = Path(__file__).resolve().parent.parent / "sample_inputs"

EXPECTED = {
    "ship_security_logging.json": "SHIP",
    "conditions_long_retention.json": "SHIP WITH CONDITIONS",
    "escalate_automated_decision.json": "ESCALATE",
    "escalate_minors.json": "ESCALATE",
}


@pytest.mark.parametrize("name,expected", EXPECTED.items())
def test_sample_decisions(name, expected):
    payload = json.loads((SAMPLES / name).read_text())
    resp = client.post("/assess", json=payload)
    assert resp.status_code == 200
    body = resp.json()
    assert body["decision"] == expected
    assert body["reasons"], "every decision must carry at least one reason"
    assert "## Decision rationale" in body["markdown"]


def test_health():
    assert client.get("/health").json() == {"status": "ok"}
