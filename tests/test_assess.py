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


def _assess(**fields):
    payload = {"feature_name": "Test feature", "feature_description": "Test description"}
    payload.update(fields)
    return client.post("/assess", json=payload)


@pytest.mark.parametrize("category", ["Special category data", "Biometric data"])
def test_special_category_data_escalates(category):
    body = _assess(data_categories=[category]).json()
    assert body["decision"] == "ESCALATE"


def test_content_logging_with_short_retention_and_security_purpose_ships():
    body = _assess(
        feature_description="Logs prompts for abuse detection, not used for training",
        data_categories=["Prompts and user content"],
        processing_operations=["Logging"],
        purposes=["Safety & security"],
        retention="14 days",
        lawful_basis_candidate="Legitimate interest",
        cross_border_transfers="None",
    ).json()
    assert body["decision"] == "SHIP"
    assert "content_sensitivity_low" in [r["id"] for r in body["risks"]]


def test_training_on_user_content_needs_conditions_and_is_flagged():
    body = _assess(
        feature_description="Logs prompts to improve the model",
        data_categories=["Prompts and user content"],
        processing_operations=["Logging"],
        purposes=["Product improvement"],
        retention="14 days",
        lawful_basis_candidate="Legitimate interest",
    ).json()
    assert body["decision"] == "SHIP WITH CONDITIONS"
    assert "training_or_reuse_user_content" in [r["id"] for r in body["risks"]]


def test_same_input_gives_same_output():
    fields = dict(data_categories=["Behavioral data"], retention="12 months", lawful_basis_candidate="Consent")
    assert _assess(**fields).json() == _assess(**fields).json()


def test_empty_feature_name_is_rejected():
    assert client.post("/assess", json={"feature_name": "", "feature_description": "x"}).status_code == 422
