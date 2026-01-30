from __future__ import annotations

import re
from typing import Dict, List, Optional, Tuple

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field


class AssessmentRequest(BaseModel):
    feature_name: str = Field(..., min_length=1)
    feature_description: str = Field(..., min_length=1)

    product_area: Optional[str] = None
    jurisdictions: Optional[List[str]] = None
    data_subjects: Optional[List[str]] = None
    data_categories: Optional[List[str]] = None
    processing_operations: Optional[List[str]] = None
    purposes: Optional[List[str]] = None
    lawful_basis_candidate: Optional[str] = None
    retention: Optional[str] = None
    vendors_involved: Optional[bool] = False
    cross_border_transfers: Optional[str] = None
    risk_appetite: Optional[str] = None
    open_questions: Optional[str] = None


class RiskItem(BaseModel):
    id: str
    title: str
    gdpr_principle: str
    impact: str
    likelihood: str
    matched_on: str
    score: int
    description: Optional[str] = None


class AssessmentResponse(BaseModel):
    decision: str
    reasons: List[str]
    conditions: List[str] = []
    risks: List[RiskItem]
    markdown: str


app = FastAPI(title="AI Feature Risk & Accountability Toolkit (Backend)")

# Dev-only CORS for local Vite frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


@app.post("/assess", response_model=AssessmentResponse)
def assess(req: AssessmentRequest) -> AssessmentResponse:
    reasons: List[str] = []
    conditions: List[str] = []
    risks: List[RiskItem] = []

    data_subjects = req.data_subjects or []
    data_categories = req.data_categories or []
    operations = req.processing_operations or []
    purposes = req.purposes or []

    lower_subjects = [s.lower() for s in data_subjects]
    lower_categories = [c.lower() for c in data_categories]
    lower_ops = [o.lower() for o in operations]
    lower_purposes = [p.lower() for p in purposes]

    has_minors = any(("child" in s) or ("minor" in s) or ("children" in s) for s in lower_subjects)
    has_special_category = _has_special_category_data(data_categories)

    retention_days = _parse_retention_days(req.retention)
    retention_over_30 = retention_days is not None and retention_days > 30

    lawful_basis_missing = not (
        req.lawful_basis_candidate
        and req.lawful_basis_candidate.strip()
        and req.lawful_basis_candidate.strip().lower() not in {"unknown", "unclear"}
    )

    # Content logging inference (based on existing fields; no new UI fields)
    content_like = any(("content" in c) or ("prompt" in c) or ("free-text" in c) or ("free text" in c) for c in lower_categories)
    logging_like = any("log" in o for o in lower_ops)
    content_logged = content_like and logging_like

    # Training / reuse inference (from ops or description keywords)
    training_or_reuse = _infer_training_or_reuse(
        feature_description=req.feature_description,
        processing_operations=operations,
        purposes=purposes,
    )

    # Automation nuance: only escalate when significant effects are inferred
    has_automation = any("automated decision" in o for o in lower_ops)
    inferred_significant_effects = _infer_significant_effects(
        feature_description=req.feature_description,
        product_area=req.product_area,
        purposes=purposes,
        processing_operations=operations,
    )

    # Purpose gating (for SHIP criteria)
    allowed_purposes = {"safety & security", "safety / security", "safety", "security", "product improvement"}
    purpose_ok = any(p in allowed_purposes for p in lower_purposes)
    retention_ok = (retention_days is None) or (retention_days <= 30)

    # --- Risk patterns (principle-based, deterministic) ---

    # Content sensitivity risk (nuanced so security + short retention can still SHIP)
    if content_logged:
        security_purpose = any(("security" in p) or ("safety" in p) for p in lower_purposes)
        cross_border_ok = (req.cross_border_transfers is None) or (req.cross_border_transfers in {"None", "Within EEA"})
        vendor_ok = not bool(req.vendors_involved)

        low_sensitivity = (
            security_purpose
            and retention_days is not None
            and retention_days <= 30
            and (not training_or_reuse)
            and cross_border_ok
            and vendor_ok
        )

        if low_sensitivity:
            risks.append(
                RiskItem(
                    id="content_sensitivity_low",
                    title="Content sensitivity risk (security logging with safeguards)",
                    gdpr_principle="Data minimisation; storage limitation; integrity and confidentiality",
                    impact="low",
                    likelihood="low",
                    matched_on="Free-text user content + logging selected (security purpose, short retention inferred)",
                    score=2,
                    description="Free-text logging appears limited to security/safety purposes with short retention and no training/reuse signals. Residual risk is treated as controlled, subject to continued enforcement of safeguards.",
                )
            )
        else:
            risks.append(
                RiskItem(
                    id="content_sensitivity",
                    title="Content sensitivity risk (free-text logging)",
                    gdpr_principle="Data minimisation; integrity and confidentiality",
                    impact="medium",
                    likelihood="medium",
                    matched_on="Free-text user content + logging selected",
                    score=6,
                    description="Logging free-text inputs increases the likelihood of capturing sensitive or confidential information and requires minimisation and access controls.",
                )
            )
            conditions.extend(
                [
                    "Implement content logging minimisation (log only what is necessary; avoid storing raw prompts where possible).",
                    "Apply redaction/PII filtering for logs and enforce strict access controls.",
                    "Document purposes for logging and communicate it transparently to users (privacy notice / in-product disclosure).",
                ]
            )

    if retention_over_30:
        risks.append(
            RiskItem(
                id="storage_limitation",
                title="Storage limitation risk (retention > 30 days)",
                gdpr_principle="Storage limitation",
                impact="medium",
                likelihood="high",
                matched_on=f"Retention parsed as {retention_days} days",
                score=7,
                description="Retention beyond 30 days increases exposure and requires a necessity/proportionality justification aligned to stated purposes.",
            )
        )
        conditions.append(
            "Reduce retention to ≤ 30 days or document a necessity/proportionality justification with safeguards (e.g., aggregation, minimisation)."
        )

    if lawful_basis_missing:
        risks.append(
            RiskItem(
                id="lawful_basis_uncertainty",
                title="Lawful basis uncertainty",
                gdpr_principle="Lawfulness, fairness and transparency",
                impact="medium",
                likelihood="medium",
                matched_on="Lawful basis candidate missing/unknown",
                score=6,
                description="A credible lawful basis must be identified and documented before deployment.",
            )
        )
        conditions.append("Define and document the lawful basis (and, where relevant, complete LIA/consent design) before launch.")

    if req.vendors_involved:
        risks.append(
            RiskItem(
                id="vendor_processor",
                title="Third-party processor accountability",
                gdpr_principle="Accountability; integrity and confidentiality",
                impact="medium",
                likelihood="medium",
                matched_on="Vendors involved",
                score=6,
                description="Processor terms must cover instructions, security, retention, sub-processors, and auditability.",
            )
        )
        conditions.append("Verify vendor processor terms, sub-processor controls, retention commitments, and security due diligence.")

    if req.cross_border_transfers and req.cross_border_transfers not in {"None", "Within EEA"}:
        risks.append(
            RiskItem(
                id="international_transfers",
                title="International transfers",
                gdpr_principle="Lawfulness; accountability",
                impact="medium",
                likelihood="medium",
                matched_on=f"Cross-border transfers: {req.cross_border_transfers}",
                score=6,
                description="Transfers require an appropriate mechanism and (where applicable) a transfer risk assessment per internal policy.",
            )
        )
        conditions.append("Confirm and document transfer mechanism (e.g., SCCs) and complete transfer risk assessment where required.")

    if training_or_reuse:
        risks.append(
            RiskItem(
                id="training_or_reuse_user_content",
                title="Training / reuse of user-provided content",
                gdpr_principle="Purpose limitation; transparency; data minimisation",
                impact="high" if (has_special_category or has_minors) else "medium",
                likelihood="medium",
                matched_on="Training/reuse inferred from description or selected operations",
                score=8 if (has_special_category or has_minors) else 6,
                description="Using prompts or user content to train or improve a model changes risk and governance expectations and requires explicit controls and transparency.",
            )
        )
        conditions.extend(
            [
                "Make training/reuse transparent in user-facing documentation and in-product disclosures, including consequences.",
                "Implement an opt-out (or obtain consent where required by internal policy) for training/reuse of user content.",
                "Minimise and protect training datasets (e.g., exclude sensitive content by default; apply filtering and access controls).",
            ]
        )

    if has_automation and inferred_significant_effects:
        risks.append(
            RiskItem(
                id="automation_significant_effects",
                title="Automation with potentially significant effects",
                gdpr_principle="Fairness; transparency; accountability",
                impact="high",
                likelihood="medium",
                matched_on="Automation + significant-effects indicators inferred from purpose/product area/description",
                score=8,
                description="Automation appears linked to consequential decisions (e.g., access, eligibility, pricing) or profiling/personalisation; governance escalation is expected.",
            )
        )
    elif has_automation and not inferred_significant_effects:
        risks.append(
            RiskItem(
                id="automation_advisory",
                title="Automation present (no significant-effects indicators)",
                gdpr_principle="Transparency; accountability",
                impact="medium",
                likelihood="medium",
                matched_on="Automation selected without significant-effects indicators",
                score=6,
                description="Automation still requires clear explanations, meaningful human oversight, and a route to contest outcomes where relevant.",
            )
        )
        conditions.extend(
            [
                "Document the role of automation and implement meaningful human oversight in practice.",
                "Provide transparency about automation and a route to contest outcomes or request human review where relevant.",
                "Implement monitoring and periodic review to detect drift, bias, or unexpected impacts.",
            ]
        )

    # --- Decision logic ---

    # Materiality: low, controlled risks should not block SHIP.
    material_risks = [r for r in risks if r.score >= 5 or r.impact.lower() in {"medium", "high"}]

    if has_minors:
        decision = "ESCALATE"
        reasons.append("Children/minors are within scope; heightened safeguards apply and escalation is required for governance review.")
    elif has_special_category:
        decision = "ESCALATE"
        reasons.append("Special category data is indicated (including proxy categories such as biometric data); escalation is required.")
    elif has_automation and inferred_significant_effects:
        decision = "ESCALATE"
        reasons.append("Automation is present with indicators of similarly significant effects; escalation is required for governance review.")
    else:
        # SHIP criteria (strict)
        if (not retention_ok) or (not purpose_ok):
            decision = "SHIP WITH CONDITIONS"
        elif has_automation and not inferred_significant_effects:
            decision = "SHIP WITH CONDITIONS"
        elif material_risks or conditions:
            decision = "SHIP WITH CONDITIONS"
        else:
            decision = "SHIP"

        if decision == "SHIP":
            reasons.append("No escalation triggers identified (no minors, no special category data, no significant-effects automation indicators).")
            reasons.append("Retention is within 30 days and purposes align to safety/security or product improvement.")
            if content_logged:
                reasons.append("Content logging appears limited to security/safety purposes with short retention and no training/reuse indicators.")
            else:
                reasons.append("On the provided inputs, residual risks appear proportionate and controlled for an internal governance workflow.")
        else:
            reasons.append("No automatic escalation trigger identified; however, one or more governance risks require documented safeguards before shipping.")
            if not purpose_ok:
                reasons.append("Stated purposes do not clearly align with safety/security or product improvement; clarify purpose limitation and necessity.")
                conditions.append("Clarify and document the specific purpose(s) and ensure processing is limited to those purposes (purpose limitation).")
            if not retention_ok:
                reasons.append("Proposed retention exceeds 30 days; storage limitation requires a necessity/proportionality justification.")
            if has_automation and not inferred_significant_effects:
                reasons.append("Automation is present without clear indicators of significant effects; transparency and oversight controls are required.")

    # If escalated, conditions should not imply approval
    if decision == "ESCALATE":
        conditions = []

    conditions = _dedupe_preserve_order(conditions)

    assumptions, follow_ups = _build_assumptions_and_followups(
        req=req,
        retention_days=retention_days,
        has_automation=has_automation,
        inferred_significant_effects=inferred_significant_effects,
        training_or_reuse=training_or_reuse,
        lawful_basis_missing=lawful_basis_missing,
    )

    markdown = _render_markdown(
        req=req,
        decision=decision,
        reasons=reasons,
        risks=risks,
        conditions=conditions,
        assumptions=assumptions,
        follow_ups=follow_ups,
    )

    return AssessmentResponse(decision=decision, reasons=reasons, conditions=conditions, risks=risks, markdown=markdown)


def _render_markdown(
    req: AssessmentRequest,
    decision: str,
    reasons: List[str],
    risks: List[RiskItem],
    conditions: List[str],
    assumptions: List[str],
    follow_ups: List[str],
) -> str:
    reasons_lines = "\n".join([f"- {r}" for r in reasons])
    conditions_lines = "\n".join([f"- {c}" for c in conditions])
    assumptions_lines = "\n".join([f"- {a}" for a in assumptions])
    follow_ups_lines = "\n".join([f"- {q}" for q in follow_ups])
    risk_lines = "\n".join(
        [
            f"- **{r.title}** — principle: {r.gdpr_principle} (impact: {r.impact}, likelihood: {r.likelihood}) — matched on: {r.matched_on}"
            for r in risks
        ]
    )

    return f"""# AI Feature Risk Assessment

## Executive summary
**Decision:** {decision}

## Feature overview
**Feature name:** {req.feature_name}

## Assumptions
{assumptions_lines or "_None._"}

## Decision rationale
{reasons_lines or "_None provided._"}

## Conditions (if applicable)
{conditions_lines or "_None._"}

## Identified risks
{risk_lines or "_No risks returned._"}

## Open questions / Follow-ups
{follow_ups_lines or "_None._"}
"""


def _parse_retention_days(retention: Optional[str]) -> Optional[int]:
    if not retention:
        return None

    s = retention.strip().lower()
    if not s:
        return None

    # Common formats: "30 days", "45d", "6 months", "90", "1 year"
    m = re.search(r"(\d+)\s*(day|days|d)\b", s)
    if m:
        return int(m.group(1))

    m = re.search(r"(\d+)\s*(month|months|m)\b", s)
    if m:
        return int(m.group(1)) * 30

    m = re.search(r"(\d+)\s*(year|years|y)\b", s)
    if m:
        return int(m.group(1)) * 365

    # If only a number is provided, treat as days
    if s.isdigit():
        return int(s)

    return None


def _has_special_category_data(data_categories: List[str]) -> bool:
    mapping_keywords = {
        # Explicit
        "special category",
        # Proxies
        "biometric",
        "health",
        "medical",
        "genetic",
        "religion",
        "political",
        "sexual",
        "union",
        "race",
        "ethnic",
    }
    for c in data_categories:
        cl = (c or "").strip().lower()
        if not cl:
            continue
        if any(kw in cl for kw in mapping_keywords):
            return True
    return False


def _infer_training_or_reuse(feature_description: str, processing_operations: List[str], purposes: List[str]) -> bool:
    ops = " ".join(processing_operations).lower()
    desc = (feature_description or "").lower()
    p = " ".join(purposes).lower()

    if "training" in ops or "train" in ops:
        return True

    # Deterministic negation handling to avoid false positives like "no training".
    haystack = f"{desc} {p}"
    negation_patterns = [
        r"\b(no|not|without)\s+(any\s+)?(training|train|fine[- ]?tune|finetune)\b",
        r"\bdo not\s+(training|train|fine[- ]?tune|finetune)\b",
        r"\bnot\s+used\s+for\s+training\b",
    ]
    if any(re.search(pat, haystack) for pat in negation_patterns):
        return False

    keywords = [
        r"\btrain\b",
        r"\bfine[- ]?tune\b",
        r"\bfinetune\b",
        "improve the model",
        "improve model",
        "model improvement",
        "learn from",
        "reuse prompts",
        "use prompts to improve",
        "use logs to improve",
        "use logs for training",
    ]
    return any((k in haystack) if " " in k else re.search(k, haystack) for k in keywords)


def _infer_significant_effects(
    feature_description: str,
    product_area: Optional[str],
    purposes: List[str],
    processing_operations: List[str],
) -> bool:
    desc = (feature_description or "").lower()
    area = (product_area or "").lower()
    p = " ".join(purposes).lower()
    ops = " ".join(processing_operations).lower()

    profiling_signal = any(x in p for x in ["personalization", "personalisation", "profiling", "targeting"])
    profiling_op_signal = "profil" in ops

    significant_keywords = [
        "eligibility",
        "eligible",
        "access",
        "deny",
        "approve",
        "revoke",
        "suspend",
        "pricing",
        "price",
        "rate",
        "quote",
        "premium",
        "credit",
        "loan",
        "insurance",
        "admission",
        "selection",
        "employment",
        "termination",
    ]
    significant_signal = any(k in desc for k in significant_keywords) or any(k in area for k in significant_keywords)

    return profiling_signal or profiling_op_signal or significant_signal


def _build_assumptions_and_followups(
    req: AssessmentRequest,
    retention_days: Optional[int],
    has_automation: bool,
    inferred_significant_effects: bool,
    training_or_reuse: bool,
    lawful_basis_missing: bool,
) -> Tuple[List[str], List[str]]:
    assumptions: List[str] = []
    follow_ups: List[str] = []

    if retention_days is None and req.retention:
        assumptions.append("Retention period could not be parsed; the assessment assumes retention is interpreted as provided by the feature team.")
        follow_ups.append("Confirm the exact retention period in days and whether automated deletion is enforced.")
    elif retention_days is None:
        assumptions.append("Retention period is not specified; the assessment assumes data is not retained beyond what is necessary for stated purposes.")
        follow_ups.append("Confirm the retention period and deletion mechanism for logs and user content.")

    if has_automation:
        assumptions.append("Automation is present based on selected processing operations.")
        if inferred_significant_effects:
            follow_ups.append("Confirm whether automated outputs are used for access, eligibility, pricing, or other similarly significant decisions.")
        else:
            follow_ups.append("Confirm whether automation has any similarly significant effects for individuals (or is advisory only).")
            follow_ups.append("Confirm the human oversight workflow and how users can contest outcomes where relevant.")

    if training_or_reuse:
        assumptions.append("Training/reuse of user content is inferred from provided inputs or description keywords.")
        follow_ups.append("Confirm whether user content is used for training/reuse, the scope (opt-in/opt-out), and the default setting.")
        follow_ups.append("Confirm minimisation measures for training datasets (e.g., filtering, exclusion of sensitive content).")

    if lawful_basis_missing:
        follow_ups.append("Confirm the lawful basis and record the rationale in the governance documentation.")

    if req.vendors_involved:
        follow_ups.append("Confirm vendor roles, data flows, and the status of processor terms and security due diligence.")

    if req.cross_border_transfers and req.cross_border_transfers not in {"None", "Within EEA"}:
        follow_ups.append("Confirm transfer mechanism and whether a transfer risk assessment is required by internal policy.")

    return assumptions, follow_ups


def _dedupe_preserve_order(items: List[str]) -> List[str]:
    seen = set()
    out: List[str] = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out

