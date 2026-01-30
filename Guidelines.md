# Guidelines

System Guidelines for AI Feature Risk & Accountability Toolkit

---

# General Guidelines

* Prioritize **clarity and explainability** over technical sophistication
* All assessment logic must be **deterministic and rule-based** - no black-box ML models
* Code should be **inspectable and auditable** - legal teams need to understand the reasoning
* Keep functions small and focused - each function should have a single, clear responsibility
* Use descriptive variable and function names that reflect legal/governance terminology
* Add docstrings to all functions explaining their purpose and logic
* Refactor code as you go to maintain clarity

---

# Backend Guidelines (FastAPI)

* Use **Pydantic schemas** for all request/response validation
* Keep API endpoints simple and focused - `/assess` is the primary endpoint
* All risk assessment logic should be in separate modules (`rules.py`, `risk_engine.py`)
* Never hardcode risk scores or decisions - use data-driven rules from YAML files
* Return structured JSON responses with clear fields:
  - `decision` or `gating_decision`: SHIP / SHIP-WITH-CONDITIONS / ESCALATE
  - `reasons`: List of human-readable explanation strings
  - `risks` or `matched_risks`: List of identified risk objects
  - `markdown` or `markdown_report`: Generated documentation
* Handle errors gracefully with informative messages
* Use type hints throughout for better maintainability

---

# Risk Assessment Logic

* **Rule-based only** - all decisions must be traceable to explicit rules
* Risk matching should be **transparent** - always include `matched_on` or `match_reason` fields
* Risk scores should be calculated deterministically based on:
  - Data categories involved
  - Processing operations
  - Jurisdictions
  - Presence of safeguards
* Gating decisions follow this hierarchy:
  1. ESCALATE if high-risk patterns with no mitigations
  2. SHIP-WITH-CONDITIONS if medium-risk with mitigations or low-risk with uncertainties
  3. SHIP if low-risk with appropriate safeguards
* Always provide **human-readable reasons** for decisions - legal teams need to understand the logic

---

# YAML Data Files

* Use clear, consistent structure across all YAML files
* Risk definitions should include:
  - `id`: Unique identifier
  - `title`: Human-readable name
  - `description`: What the risk is
  - `triggers`: Conditions that match this risk (data categories, operations, etc.)
  - `impact`: High/Medium/Low
  - `likelihood`: High/Medium/Low
  - `mitigations`: List of possible safeguards
* Keep YAML files readable - use comments (`#`) to explain complex rules
* Validate YAML structure matches expected schemas

---

# Documentation Generation (Markdown)

* All markdown outputs should be **structured and professional** - suitable for legal review
* Include clear sections:
  - Executive summary
  - Risk assessment
  - Identified risks with details
  - Recommended safeguards/conditions
  - Follow-up actions
  - Open questions
* Use proper markdown formatting (headers, lists, tables)
* Ensure outputs are **auditable** - include timestamps, input parameters, decision rationale
* Markdown should be downloadable and shareable with legal/compliance teams

---

# UI Guidelines (Streamlit)

* Keep the interface **simple and focused** - this is a governance tool, not a consumer app
* Use clear labels and help text for all inputs
* Required fields should be marked with asterisks (*)
* Display results in a clear, two-column layout:
  - Left: Decision and reasons
  - Right: Documentation output
* Show raw JSON response in an expander for debugging/transparency
* Error messages should be helpful - guide users to fix issues
* Use appropriate Streamlit components (text_input, selectbox, multiselect) based on input type

---

# Testing Guidelines

* Write tests for all risk assessment logic
* Test edge cases: empty inputs, missing fields, invalid combinations
* Test that decisions are consistent and reproducible
* Test markdown generation produces valid, well-formatted output
* Mock external dependencies in tests
* Keep tests readable - they serve as documentation of expected behavior

---

# Code Organization

* Follow the project structure outlined in README.md
* Keep backend logic in `backend/app/` modules
* Keep data files in `data/` directory
* Keep UI code in `ui/` directory
* Put reusable utilities in appropriate modules
* Don't mix concerns - separate data, logic, and presentation layers

---

# GDPR and Legal Compliance Focus

* Always consider **accountability** - can decisions be explained and justified?
* Emphasize **transparency** - users should understand why decisions were made
* Support **auditability** - all logic should be reviewable by legal teams
* Remember this is a **support tool**, not a replacement for legal review
* When in doubt, err on the side of **caution and escalation** rather than auto-approval

---

# Performance and Scalability

* This is an internal governance tool - prioritize clarity over performance
* Keep response times reasonable (< 5 seconds for assessments)
* Don't optimize prematurely - readability is more important
* If performance becomes an issue, optimize while maintaining explainability
