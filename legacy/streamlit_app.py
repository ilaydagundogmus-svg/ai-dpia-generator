"""
LEGACY PROTOTYPE (Streamlit)

This Streamlit app is kept for reference as an early demo/prototype.
The primary product interface for this project is the Figma-designed React UI under /src.
"""

import json
from typing import Any, Dict, List

import requests
import streamlit as st

BACKEND_URL = "http://localhost:8501"


def _post_assess(payload: Dict[str, Any]) -> Dict[str, Any]:
    resp = requests.post(f"{BACKEND_URL}/assess", json=payload, timeout=30)
    resp.raise_for_status()
    return resp.json()


st.set_page_config(page_title="AI Feature Risk & Accountability Toolkit", layout="wide")

st.title("AI Feature Risk & Accountability Toolkit")
st.caption("Internal governance assessment for AI product features")

with st.sidebar:
    st.subheader("Assessment inputs")

    feature_name = st.text_input("Feature name *")
    feature_description = st.text_area("Feature description *", height=140)

    product_area = st.selectbox(
        "Product area",
        ["chat assistant", "API platform", "analytics", "other"],
        index=0,
    )

    jurisdictions = st.multiselect("Jurisdiction(s)", ["EEA", "UK", "US", "Other"], default=["EEA"])

    data_subjects = st.multiselect(
        "Data subjects",
        ["end users", "customer employees", "employees"],
        default=["end users"],
    )

    data_categories = st.multiselect(
        "Data categories",
        ["content/prompts", "usage logs", "identifiers", "other"],
        default=["content/prompts", "usage logs"],
    )

    processing_operations = st.multiselect(
        "Processing operations",
        ["collection", "storage", "analysis", "logging", "training"],
        default=["collection", "storage", "analysis", "logging"],
    )

    purposes = st.multiselect(
        "Purpose(s)",
        ["product improvement", "security", "compliance"],
        default=["product improvement", "security"],
    )

    lawful_basis = st.selectbox("Lawful basis candidate", ["contract", "legitimate interest", "consent", "unknown"], index=1)

    retention = st.text_input("Retention period", value="30 days")

    vendors_involved = st.checkbox("Vendors involved", value=False)

    cross_border_transfers = st.selectbox("Cross-border transfers", ["yes", "no", "unknown"], index=2)

    risk_appetite = st.selectbox("Risk appetite", ["low", "medium", "high"], index=1)

    open_questions = st.text_area("Open questions (optional)", height=90)

    run = st.button("Run assessment", type="primary")


def build_payload() -> Dict[str, Any]:
    # Keep payload simple and readable. Backend can ignore unknown fields if needed.
    return {
        "feature_name": feature_name.strip(),
        "feature_description": feature_description.strip(),
        "product_area": product_area,
        "jurisdictions": jurisdictions,
        "data_subjects": data_subjects,
        "data_categories": data_categories,
        "processing_operations": processing_operations,
        "purposes": purposes,
        "lawful_basis_candidate": lawful_basis,
        "retention": retention.strip(),
        "vendors_involved": vendors_involved,
        "cross_border_transfers": cross_border_transfers,
        "risk_appetite": risk_appetite,
        "open_questions": open_questions.strip(),
    }


col1, col2 = st.columns([1, 1], gap="large")

if run:
    if not feature_name.strip() or not feature_description.strip():
        st.error("Please fill in the required fields: Feature name and Feature description.")
    else:
        payload = build_payload()
        with st.spinner("Running assessment..."):
            try:
                result = _post_assess(payload)
            except requests.exceptions.ConnectionError:
                st.error(
                    "Cannot reach the backend. Make sure FastAPI is running on http://localhost:8501 "
                    "and that /assess is available."
                )
                result = None
            except requests.HTTPError as e:
                st.error(f"Backend returned an error: {e}")
                try:
                    st.code(e.response.text)
                except Exception:
                    pass
                result = None
            except Exception as e:
                st.error(f"Unexpected error: {e}")
                result = None

        if result:
            decision = result.get("decision") or result.get("gating_decision") or "N/A"
            reasons = result.get("reasons") or []
            risks = result.get("risks") or result.get("matched_risks") or []
            markdown = result.get("markdown") or result.get("markdown_report") or result.get("report_md") or ""

            with col1:
                st.subheader("Decision")
                st.metric("Gating decision", str(decision))

                st.subheader("Reasons")
                if isinstance(reasons, list) and reasons:
                    for r in reasons:
                        st.write(f"- {r}")
                elif isinstance(reasons, str) and reasons.strip():
                    st.write(reasons)
                else:
                    st.write("_No reasons provided by backend._")

                st.subheader("Identified risks")
                if isinstance(risks, list) and risks:
                    # Try to show as a table if dict-like
                    if all(isinstance(x, dict) for x in risks):
                        rows: List[Dict[str, Any]] = []
                        for x in risks:
                            rows.append(
                                {
                                    "id": x.get("id", ""),
                                    "title": x.get("title", ""),
                                    "score": x.get("score", x.get("risk_score", "")),
                                    "impact": x.get("impact", ""),
                                    "likelihood": x.get("likelihood", ""),
                                    "matched_on": x.get("matched_on", x.get("match_reason", "")),
                                }
                            )
                        st.dataframe(rows, use_container_width=True)
                    else:
                        for x in risks:
                            st.write(f"- {x}")
                else:
                    st.write("_No risks returned._")

            with col2:
                st.subheader("Accountability Pack (Markdown)")
                if markdown:
                    st.markdown(markdown)
                    st.download_button(
                        label="Download Markdown",
                        data=markdown.encode("utf-8"),
                        file_name="accountability_pack.md",
                        mime="text/markdown",
                    )
                else:
                    st.info("Backend did not return a Markdown report.")

            st.divider()
            with st.expander("Raw JSON response", expanded=False):
                st.code(json.dumps(result, indent=2), language="json")

st.caption("This tool supports internal governance workflows and does not replace legal review.")

