export type Decision = "SHIP" | "SHIP_WITH_CONDITIONS" | "ESCALATE";

export interface AssessmentRequest {
  feature_name: string;
  feature_description: string;

  // Optional context fields (backend may ignore unknowns)
  product_area?: string;
  jurisdictions?: string[];
  data_subjects?: string[];
  data_categories?: string[];
  processing_operations?: string[];
  purposes?: string[];
  lawful_basis_candidate?: string;
  retention?: string;
  vendors_involved?: boolean;
  cross_border_transfers?: string;
  risk_appetite?: string;
  open_questions?: string;
}

export interface RiskItem {
  id?: string;
  title?: string;
  description?: string;
  gdpr_principle?: string;
  score?: number | string;
  impact?: string;
  likelihood?: string;
  matched_on?: string;
}

export interface AssessmentResponse {
  decision: Decision | string;
  reasons: string[];
  conditions: string[];
  risks: RiskItem[];
  markdown: string;
}

export function normalizeAssessmentResponse(raw: unknown): AssessmentResponse {
  const obj = (raw ?? {}) as Record<string, unknown>;

  const decision =
    (obj.decision as string | undefined) ??
    (obj.gating_decision as string | undefined) ??
    "N/A";

  const reasonsRaw = (obj.reasons as unknown) ?? [];
  const reasons: string[] = Array.isArray(reasonsRaw)
    ? reasonsRaw.map((x) => String(x))
    : typeof reasonsRaw === "string"
      ? reasonsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

  const risksRaw = (obj.risks as unknown) ?? (obj.matched_risks as unknown) ?? [];
  const risks: RiskItem[] = Array.isArray(risksRaw)
    ? risksRaw.map((x) => {
        if (x && typeof x === "object") {
          const r = x as Record<string, unknown>;
          return {
            id: typeof r.id === "string" ? r.id : undefined,
            title: typeof r.title === "string" ? r.title : undefined,
            description: typeof r.description === "string" ? r.description : undefined,
            gdpr_principle:
              (typeof r.gdpr_principle === "string" ? r.gdpr_principle : undefined) ??
              (typeof r.principle === "string" ? r.principle : undefined),
            score: (r.score as any) ?? (r.risk_score as any),
            impact: typeof r.impact === "string" ? r.impact : undefined,
            likelihood: typeof r.likelihood === "string" ? r.likelihood : undefined,
            matched_on:
              (typeof r.matched_on === "string" ? r.matched_on : undefined) ??
              (typeof r.match_reason === "string" ? r.match_reason : undefined),
          };
        }
        return { title: String(x) };
      })
    : [];

  const markdown =
    (obj.markdown as string | undefined) ??
    (obj.markdown_report as string | undefined) ??
    (obj.report_md as string | undefined) ??
    "";

  const conditionsRaw = (obj.conditions as unknown) ?? (obj.required_actions as unknown) ?? [];
  const conditions: string[] = Array.isArray(conditionsRaw)
    ? conditionsRaw.map((x) => String(x))
    : typeof conditionsRaw === "string"
      ? conditionsRaw.split("\n").map((s) => s.trim()).filter(Boolean)
      : [];

  return { decision, reasons, conditions, risks, markdown };
}

