# AI Feature Risk & Accountability Toolkit

An internal governance prototype for feature-level risk assessment and accountability in AI product development.

---

## Overview

**AI Feature Risk & Accountability Toolkit** is an internal governance prototype designed to support structured, principle-based risk and accountability assessments for AI-powered product features.

The toolkit focuses on **decision-making and documentation workflows**, rather than technical enforcement. It demonstrates how privacy, data protection, and AI-related risks can be translated into:

- clear feature-level governance and escalation decisions,
- documented safeguards and follow-up actions,
- reusable accountability artefacts that support regulatory compliance and internal review.

The project is intentionally scoped as a **reference implementation** to illustrate how legal, product, and engineering teams can collaborate around AI governance in practice.

---

## Running locally

### Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

> If you run from the repository root, the equivalent module path is:
> `uvicorn backend.app.main:app --reload --port 8000 --reload-dir backend`

### Frontend (React / Vite)

```bash
npm install
npm run dev
```

- **Frontend**: `http://localhost:5173`
- **Backend**: `http://localhost:8000`
- **Env var (optional)**: `VITE_BACKEND_URL` (defaults to `http://localhost:8000`)

If the backend is not available, the UI will show **demo output** (non-blocking fallback).

---

## Purpose and Scope

This toolkit is not intended to replace formal legal review or DPO oversight.

Instead, it serves as an internal support mechanism to:

- surface legal and governance risks early in feature design,
- structure discussions between product, engineering, and compliance teams,
- operationalise GDPR accountability requirements in a scalable and repeatable way.

The emphasis is on **legal reasoning, explainability, and governance maturity**, not on automation for its own sake.

In this sense, the toolkit operationalises the GDPR accountability principle by ensuring that key design decisions, assumptions, and safeguards are explicitly recorded, reviewable, and attributable.

---

## Key Capabilities

- **Feature-Level Gating Decisions**  
  Structured SHIP / SHIP-WITH-CONDITIONS / ESCALATE logic based on risk patterns, safeguards, and unresolved uncertainties.

- **Principle-Based Risk Reasoning**  
  Assessments are grounded in GDPR principles such as purpose limitation, data minimisation, transparency, security, and accountability, rather than checkbox compliance.

- **AI-Specific Risk Patterns**  
  Built-in handling of common AI risks, including:
  - prompt and interaction logging,
  - model training on user-provided content,
  - profiling and automated decision-making,
  - model memorisation and re-identification risks,
  - cross-border data flows and vendor involvement.

- **Accountability Documentation Outputs**  
  Automated generation of structured documentation artefacts, including:
  - DPIA-style assessment skeletons,
  - RoPA-style processing summaries,
  - mini legitimate interest assessments (where applicable),
  - DSAR readiness checklists.

- **Operational Follow-Ups**  
  Clear identification of required legal, product, and engineering follow-ups, such as transparency updates, retention limits, vendor contract reviews, or escalation triggers.

- **Explainability by Design**  
  All decisions are rule-based and human-readable, supporting auditability, internal challenge, and supervisory authority expectations.

---

## Governance-Oriented Design

The toolkit reflects a governance-first approach to AI product development:

- Risk is treated as a **decision input**, not a post-hoc compliance exercise.
- Documentation is generated as a **by-product of decision-making**, not as an afterthought.
- Legal requirements are translated into **operational constraints and conditions**, enabling faster and more informed product iteration.

This design mirrors how mature in-house teams manage AI-related regulatory risk in fast-moving environments.

---

## Project Structure

```
ai-feature-risk-toolkit/
├── src/                     # Primary UI (React / Vite, Figma-based)
│   └── app/
│       └── components/
│           └── ui-kit/       # Reusable UI components (not a separate app)
├── legacy/
│   └── streamlit_app.py      # Legacy Streamlit prototype (kept for reference)
├── backend/                  # Reserved for backend services (optional)
├── data/
│   ├── risks.yaml
│   ├── dpa_playbook.yaml
│   └── training_snippets.yaml
├── sample_inputs/
├── tests/
└── README.md
```

> The **React UI under `/src`** is the primary interface. The Streamlit app under `/legacy` is retained only as an early prototype reference.

---

## Technical Notes

The implementation prioritises clarity and explainability over technical sophistication.

- **Backend**: Python (FastAPI) with deterministic, rule-based assessment logic (principle-based mapping; automation nuance handled via inferred “significant effects” triggers)  
- **Risk & Policy Packs**: YAML-based libraries for risks, mitigations, and governance playbooks  
- **Documentation**: Markdown outputs designed for legal review and auditability  
- **UI (primary)**: React (Vite) frontend under `/src` (Figma-based)  
- **UI (legacy)**: Streamlit prototype under `/legacy` (kept for reference)

All logic is designed to be inspectable, extendable, and suitable for internal governance use.

---

## Disclaimer

This project is provided as an internal governance reference and workflow support tool.

It does not constitute legal advice and does not replace formal legal analysis, DPO review, or engagement with supervisory authorities where required. All outputs are intended to support — not substitute — professional judgment.

---

## License

MIT License


## Primary UI

This repository’s **primary user interface** is the Figma-designed React application under `/src`.

The Streamlit UI is a **legacy prototype** preserved under `/legacy` for reference and should not be treated as the product interface.

