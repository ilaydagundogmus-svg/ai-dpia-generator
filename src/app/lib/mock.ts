import type { AssessmentResponse } from "./types";

export const MOCK_ASSESSMENT: AssessmentResponse = {
  decision: "SHIP_WITH_CONDITIONS",
  reasons: [
    "No automatic escalation trigger identified on the demo inputs; however, residual governance risks require documented safeguards prior to deployment.",
    "Logging free-text user content increases the chance of capturing sensitive data and requires minimisation and access controls (GDPR Art. 5(1)(c),(f)).",
    "Retention beyond 30 days requires necessity/proportionality justification under storage limitation (GDPR Art. 5(1)(e)).",
  ],
  conditions: [
    "Implement content logging minimisation and avoid storing raw prompts where not necessary.",
    "Apply redaction/PII filtering to logs and restrict access on a least-privilege basis.",
    "Reduce retention to ≤ 30 days or document a necessity/proportionality justification with safeguards.",
  ],
  risks: [
    {
      id: "transfer_ch5",
      title: "International transfers (GDPR Chapter V)",
      gdpr_principle: "Lawfulness & accountability (GDPR Chapter V)",
      impact: "medium",
      likelihood: "medium",
      matched_on: "Cross-border transfers indicated",
      score: 6,
    },
    {
      id: "vendor_processor",
      title: "Third-party processor accountability",
      gdpr_principle: "Accountability; integrity and confidentiality",
      impact: "medium",
      likelihood: "medium",
      matched_on: "Vendors involved",
      score: 6,
    },
    {
      id: "content_sensitivity",
      title: "Content sensitivity risk (free-text logging)",
      gdpr_principle: "Data minimisation; integrity and confidentiality",
      impact: "medium",
      likelihood: "medium",
      matched_on: "Free-text user content + logging selected",
      score: 6,
    },
  ],
  markdown: `# AI Feature Risk Assessment (Demo)

## Executive summary
**Decision:** SHIP WITH CONDITIONS  
**Assessment date:** (demo)

## Key findings
- Logging free-text content requires minimisation and security controls.
- Retention beyond 30 days must be justified under storage limitation.

## Conditions to ship
1. Implement content logging minimisation and redaction/PII filtering.
2. Reduce retention to ≤ 30 days or document necessity with safeguards.
3. Ensure access controls and auditability for logged content.

## Notes
This is **demo output** shown because the backend was not available.`,
};

