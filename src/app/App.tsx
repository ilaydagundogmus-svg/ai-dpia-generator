import { useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";

import { assessFeature } from "./lib/api";
import type { AssessmentRequest, AssessmentResponse, Decision, RiskItem } from "./lib/types";

type AssessmentState = 'form' | 'results';
type View = 'assess' | 'how';

interface DecisionStyle {
  label: string;
  meaning: string;
  icon: string;
  card: string;
  badge: string;
}

function toDecisionBadge(decision: string): DecisionStyle {
  const normalized = decision.toUpperCase().replace(/\s+/g, "_");
  const d = normalized as Decision;

  if (d === "SHIP")
    return {
      label: "SHIP",
      meaning: "No escalation trigger found. Proceed.",
      icon: "✓",
      card: "bg-[#f0fdf4] border-[#86efac]",
      badge: "bg-[#16a34a] text-white",
    };
  if (d === "SHIP_WITH_CONDITIONS")
    return {
      label: "SHIP WITH CONDITIONS",
      meaning: "Can proceed once the conditions below are met and documented.",
      icon: "!",
      card: "bg-[#fffbeb] border-[#fcd34d]",
      badge: "bg-[#d97706] text-white",
    };
  if (d === "ESCALATE")
    return {
      label: "ESCALATE",
      meaning: "Do not ship yet. Send to legal, privacy or the DPO for a decision.",
      icon: "↑",
      card: "bg-[#fef2f2] border-[#fca5a5]",
      badge: "bg-[#dc2626] text-white",
    };

  return {
    label: decision || "N/A",
    meaning: "",
    icon: "?",
    card: "bg-white border-[#e5e5e5]",
    badge: "bg-[#64748b] text-white",
  };
}

function levelChip(level?: string): string {
  const l = (level ?? "").toLowerCase();
  if (l === "high") return "bg-[#fee2e2] text-[#991b1b]";
  if (l === "medium") return "bg-[#fef3c7] text-[#92400e]";
  if (l === "low") return "bg-[#dcfce7] text-[#166534]";
  return "bg-[#f1f5f9] text-[#475569]";
}

interface Example {
  label: string;
  featureName: string;
  featureDescription: string;
  productArea: string;
  jurisdictions: string;
  dataSubjects: string[];
  dataCategories: string[];
  processingOperations: string[];
  purposes: string[];
  lawfulBasis: string;
  retention: string;
  vendors: boolean;
  crossBorder: string;
}

const EXAMPLES: Example[] = [
  {
    label: "Abuse detection",
    featureName: "Abuse detection signals",
    featureDescription:
      "Short-lived signals used to detect spam and abuse in an assistant feature. Not used for model training.",
    productArea: "Trust & Safety",
    jurisdictions: "EEA",
    dataSubjects: ["End users"],
    dataCategories: ["Behavioral data"],
    processingOperations: ["Collection", "Analysis"],
    purposes: ["Safety & security"],
    lawfulBasis: "Legitimate interest",
    retention: "14 days",
    vendors: false,
    crossBorder: "None",
  },
  {
    label: "Personalised feed",
    featureName: "Personalised content feed",
    featureDescription: "Recommends content based on past activity. Profiles are kept for a year.",
    productArea: "Recommendations",
    jurisdictions: "EEA, UK",
    dataSubjects: ["End users"],
    dataCategories: ["Behavioral data", "Personal identifiers"],
    processingOperations: ["Collection", "Storage", "Analysis"],
    purposes: ["User personalization"],
    lawfulBasis: "Consent",
    retention: "12 months",
    vendors: true,
    crossBorder: "Within EEA",
  },
  {
    label: "Automated loan decision",
    featureName: "Automated loan eligibility",
    featureDescription: "Rules automatically approve or deny loan applications without human review.",
    productArea: "Lending",
    jurisdictions: "EEA",
    dataSubjects: ["End users"],
    dataCategories: ["Personal identifiers"],
    processingOperations: ["Collection", "Automated decision-making"],
    purposes: ["Product improvement"],
    lawfulBasis: "Contractual necessity",
    retention: "90 days",
    vendors: false,
    crossBorder: "None",
  },
  {
    label: "Homework helper",
    featureName: "Homework helper",
    featureDescription: "AI homework help for school students.",
    productArea: "Education",
    jurisdictions: "EEA",
    dataSubjects: ["Children (under applicable data protection law)"],
    dataCategories: ["Behavioral data"],
    processingOperations: ["Collection", "Storage"],
    purposes: ["Product improvement"],
    lawfulBasis: "Consent",
    retention: "7 days",
    vendors: false,
    crossBorder: "None",
  },
];

function parseCommaList(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toggleInList(list: string[], value: string, checked: boolean): string[] {
  const set = new Set(list);
  if (checked) set.add(value);
  else set.delete(value);
  return Array.from(set);
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [currentState, setCurrentState] = useState<AssessmentState>("form");

  // Form state
  const [featureName, setFeatureName] = useState("");
  const [featureDescription, setFeatureDescription] = useState("");
  const [productArea, setProductArea] = useState("");
  const [jurisdictionsText, setJurisdictionsText] = useState("");

  const [dataSubjects, setDataSubjects] = useState<string[]>([]);
  const [dataCategories, setDataCategories] = useState<string[]>([]);
  const [processingOperations, setProcessingOperations] = useState<string[]>([]);
  const [purposes, setPurposes] = useState<string[]>([]);

  const [lawfulBasisCandidate, setLawfulBasisCandidate] = useState("");
  const [retention, setRetention] = useState("");
  const [vendorsInvolved, setVendorsInvolved] = useState(false);
  const [crossBorderTransfers, setCrossBorderTransfers] = useState("None");
  const [riskAppetite, setRiskAppetite] = useState("Medium");

  // Assessment state
  const [isLoading, setIsLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [demoNotice, setDemoNotice] = useState<string | null>(null);
  const [assessment, setAssessment] = useState<AssessmentResponse | null>(null);

  const [view, setView] = useState<View>("assess");

  const decisionBadge = useMemo(() => {
    const d = assessment?.decision ? String(assessment.decision) : "N/A";
    return toDecisionBadge(d);
  }, [assessment?.decision]);

  const loadExample = (ex: Example) => {
    setFeatureName(ex.featureName);
    setFeatureDescription(ex.featureDescription);
    setProductArea(ex.productArea);
    setJurisdictionsText(ex.jurisdictions);
    setDataSubjects(ex.dataSubjects);
    setDataCategories(ex.dataCategories);
    setProcessingOperations(ex.processingOperations);
    setPurposes(ex.purposes);
    setLawfulBasisCandidate(ex.lawfulBasis);
    setRetention(ex.retention);
    setVendorsInvolved(ex.vendors);
    setCrossBorderTransfers(ex.crossBorder);
    setFormError(null);
  };

  const resetAll = () => {
    setFeatureName("");
    setFeatureDescription("");
    setProductArea("");
    setJurisdictionsText("");
    setDataSubjects([]);
    setDataCategories([]);
    setProcessingOperations([]);
    setPurposes([]);
    setLawfulBasisCandidate("");
    setRetention("");
    setVendorsInvolved(false);
    setCrossBorderTransfers("None");
    setRiskAppetite("Medium");
    setFormError(null);
    setDemoNotice(null);
    setAssessment(null);
    setCurrentState("form");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    setFormError(null);
    setDemoNotice(null);

    if (!featureName.trim() || !featureDescription.trim()) {
      setFormError("Please fill in the required fields: Feature name and Feature description.");
      return;
    }

    const payload: AssessmentRequest = {
      feature_name: featureName.trim(),
      feature_description: featureDescription.trim(),
      product_area: productArea.trim() || undefined,
      jurisdictions: jurisdictionsText.trim() ? parseCommaList(jurisdictionsText) : undefined,
      data_subjects: dataSubjects.length ? dataSubjects : undefined,
      data_categories: dataCategories.length ? dataCategories : undefined,
      processing_operations: processingOperations.length ? processingOperations : undefined,
      purposes: purposes.length ? purposes : undefined,
      lawful_basis_candidate: lawfulBasisCandidate || undefined,
      retention: retention.trim() || undefined,
      vendors_involved: vendorsInvolved,
      cross_border_transfers: crossBorderTransfers,
      risk_appetite: riskAppetite,
    };

    setIsLoading(true);
    try {
      const { data, isDemoFallback } = await assessFeature(payload);
      setAssessment(data);
      setCurrentState("results");
      document.querySelector("main")?.scrollTo({ top: 0 });
      if (isDemoFallback) {
        setDemoNotice(
          "Demo output: the backend could not be reached, so this result is a fixed sample and was not computed from your input."
        );
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-[#fafafa]">
      {/* Sidebar (desktop) / top bar (mobile) */}
      <aside className="md:w-64 bg-white border-b md:border-b-0 md:border-r border-[#e5e5e5] flex-shrink-0">
        <div className="px-4 py-3 md:p-6">
          <h2 className="text-[#1a1a1a] tracking-tight">AI Feature Risk & Accountability Toolkit</h2>
        </div>
        <nav className="px-4 pb-3 md:pb-0 flex md:block gap-1 md:space-y-1" aria-label="Main">
          {([
            ["assess", "New assessment"],
            ["how", "How decisions are made"],
          ] as [View, string][]).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              aria-current={view === id ? "page" : undefined}
              className={`block w-full text-left px-3 py-2 rounded ${
                view === id ? "text-[#0f172a] bg-[#f1f5f9]" : "text-[#64748b] hover:bg-[#f8f9fa]"
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-6 md:py-8">
          {view === 'how' && (
            <div>
              <div className="mb-8">
                <h1 className="text-[#0f172a] mb-2">How decisions are made</h1>
                <p className="text-[#64748b]">
                  Deterministic rules, no machine learning. The same input always gives the same result.
                </p>
                <div className="h-px bg-[#e5e5e5] mt-6"></div>
              </div>
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6">
                <h3 className="text-[#0f172a] mb-4">Three outcomes</h3>
                <ul className="space-y-3 text-[#475569]">
                  <li><strong className="text-[#dc2626]">ESCALATE</strong>: children among data subjects, special category or biometric data, or automated decisions with signs of significant effects. A person with authority decides.</li>
                  <li><strong className="text-[#d97706]">SHIP WITH CONDITIONS</strong>: no escalation trigger, but retention, purpose fit, matched risks or open conditions need documented safeguards.</li>
                  <li><strong className="text-[#16a34a]">SHIP</strong>: no trigger, short retention, a clear safety or product-improvement purpose and no material risks.</li>
                </ul>
              </div>
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6">
                <h3 className="text-[#0f172a] mb-4">Limits</h3>
                <ul className="space-y-2 text-[#475569]">
                  <li>• The 30-day retention threshold and the list of accepted purposes are illustrative choices, not legal requirements.</li>
                  <li>• Free-text checks (training or reuse, significant effects) use keyword matching and can miss or over-trigger.</li>
                  <li>• The tool does not interpret legislation and does not replace legal review or a DPO.</li>
                </ul>
              </div>
            </div>
          )}

          {view === 'assess' && currentState === 'form' && (
            <form onSubmit={handleSubmit}>
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-[#0f172a] mb-2">Feature Risk & Accountability Assessment</h1>
                <p className="text-[#64748b]">Internal governance review for AI product features</p>
                <div className="h-px bg-[#e5e5e5] mt-6"></div>
              </div>

              {/* Example loader */}
              <div className="mb-8">
                <p className="text-[#64748b] text-sm mb-2">New here? Load an example and run it:</p>
                <div className="flex flex-wrap gap-2">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex.label}
                      type="button"
                      onClick={() => loadExample(ex)}
                      className="px-3 py-1.5 text-sm bg-white border border-[#cbd5e1] text-[#475569] rounded-full hover:bg-[#f8f9fa]"
                    >
                      {ex.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Feature Overview Section */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-8">
                <h3 className="text-[#0f172a] mb-6">Feature Overview</h3>
                
                <div className="space-y-5">
                  {formError && (
                    <div className="border border-[#fecaca] bg-[#fef2f2] text-[#991b1b] rounded p-3 text-sm">
                      {formError}
                    </div>
                  )}

                  <div>
                    <label htmlFor="featureName" className="block text-[#0f172a] mb-2">
                      Feature name <span className="text-[#dc2626]" aria-hidden="true">*</span>
                    </label>
                    <input
                      type="text"
                      id="featureName"
                      value={featureName}
                      onChange={(e) => setFeatureName(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="featureDescription" className="block text-[#0f172a] mb-2">
                      Feature description <span className="text-[#dc2626]" aria-hidden="true">*</span>
                    </label>
                    <textarea
                      id="featureDescription"
                      rows={4}
                      value={featureDescription}
                      onChange={(e) => setFeatureDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
                    <p className="text-[#64748b] text-sm mt-1">Describe the feature at a high level</p>
                  </div>

                  <div>
                    <label htmlFor="productArea" className="block text-[#0f172a] mb-2">
                      Product area
                    </label>
                    <input
                      type="text"
                      id="productArea"
                      value={productArea}
                      onChange={(e) => setProductArea(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
                  </div>

                  <div>
                    <label htmlFor="jurisdiction" className="block text-[#0f172a] mb-2">
                      Jurisdiction(s)
                    </label>
                    <input
                      type="text"
                      id="jurisdiction"
                      value={jurisdictionsText}
                      onChange={(e) => setJurisdictionsText(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
                    <p className="text-[#64748b] text-sm mt-1">Comma-separated (e.g., EEA, UK, US)</p>
                  </div>
                </div>
              </div>

              {/* Data & Processing Context Section */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-8">
                <h3 className="text-[#0f172a] mb-6">Data and Processing Context</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[#0f172a] mb-2">Data subjects</label>
                    <div className="space-y-2">
                      {['End users', 'Employees', 'Business partners', 'Children (under applicable data protection law)'].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-2 rounded border-[#cbd5e1]"
                            checked={dataSubjects.includes(option)}
                            onChange={(e) =>
                              setDataSubjects((prev) => toggleInList(prev, option, e.target.checked))
                            }
                          />
                          <span className="text-[#0f172a]">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#0f172a] mb-2">Data categories</label>
                    <div className="space-y-2">
                      {['Personal identifiers', 'Behavioral data', 'Prompts and user content', 'Biometric data', 'Special category data'].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-2 rounded border-[#cbd5e1]"
                            checked={dataCategories.includes(option)}
                            onChange={(e) =>
                              setDataCategories((prev) => toggleInList(prev, option, e.target.checked))
                            }
                          />
                          <span className="text-[#0f172a]">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#0f172a] mb-2">Processing operations</label>
                    <div className="space-y-2">
                      {['Collection', 'Storage', 'Logging', 'Analysis', 'Automated decision-making'].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-2 rounded border-[#cbd5e1]"
                            checked={processingOperations.includes(option)}
                            onChange={(e) =>
                              setProcessingOperations((prev) => toggleInList(prev, option, e.target.checked))
                            }
                          />
                          <span className="text-[#0f172a]">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-[#0f172a] mb-2">Purpose(s)</label>
                    <div className="space-y-2">
                      {['Product improvement', 'User personalization', 'Safety & security', 'Research'].map((option) => (
                        <label key={option} className="flex items-center">
                          <input
                            type="checkbox"
                            className="mr-2 rounded border-[#cbd5e1]"
                            checked={purposes.includes(option)}
                            onChange={(e) =>
                              setPurposes((prev) => toggleInList(prev, option, e.target.checked))
                            }
                          />
                          <span className="text-[#0f172a]">{option}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Governance Parameters Section */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-8">
                <h3 className="text-[#0f172a] mb-6">Governance Parameters</h3>
                
                <div className="space-y-5">
                  <div>
                    <label htmlFor="lawfulBasis" className="block text-[#0f172a] mb-2">
                      Lawful basis candidate
                    </label>
                    <select
                      id="lawfulBasis"
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                      value={lawfulBasisCandidate}
                      onChange={(e) => setLawfulBasisCandidate(e.target.value)}
                    >
                      <option value="" disabled>Select lawful basis</option>
                      <option>Consent</option>
                      <option>Contractual necessity</option>
                      <option>Legal obligation</option>
                      <option>Legitimate interest</option>
                      <option>Vital interests</option>
                      <option>Public task</option>
                    </select>
                  </div>

                  <div>
                    <label htmlFor="retention" className="block text-[#0f172a] mb-2">
                      Retention period
                    </label>
                    <input
                      type="text"
                      id="retention"
                      value={retention}
                      placeholder="e.g. 30 days, 6 months, 1 year"
                      onChange={(e) => setRetention(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
                    <p className="text-[#64748b] text-sm mt-1">Leave empty if unknown; the tool then records an assumption.</p>
                  </div>

                  <div>
                    <label className="flex items-center">
                      <input
                        type="checkbox"
                        className="mr-2 rounded border-[#cbd5e1]"
                        checked={vendorsInvolved}
                        onChange={(e) => setVendorsInvolved(e.target.checked)}
                      />
                      <span className="text-[#0f172a]">Vendors involved</span>
                    </label>
                  </div>

                  <div>
                    <label htmlFor="crossBorder" className="block text-[#0f172a] mb-2">
                      Cross-border transfers
                    </label>
                    <select
                      id="crossBorder"
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                      value={crossBorderTransfers}
                      onChange={(e) => setCrossBorderTransfers(e.target.value)}
                    >
                      <option>None</option>
                      <option>Within EEA</option>
                      <option>To adequate country</option>
                      <option>With safeguards (SCCs)</option>
                      <option>Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[#0f172a] mb-3">Risk appetite</label>
                    <div className="flex gap-3">
                      {['Low', 'Medium', 'High'].map((level) => (
                        <label key={level} className="flex items-center px-4 py-2 border border-[#cbd5e1] rounded cursor-pointer hover:bg-[#f8f9fa]">
                          <input
                            type="radio"
                            name="riskAppetite"
                            className="mr-2"
                            checked={riskAppetite === level}
                            onChange={() => setRiskAppetite(level)}
                          />
                          <span className="text-[#0f172a]">{level}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-[#64748b] text-sm mt-2">Indicates the organisation's tolerance for residual legal and compliance risk.</p>
                  </div>
                </div>
              </div>

              {/* Primary Action */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-[#475569] text-white rounded hover:bg-[#334155] transition-colors"
                >
                  {isLoading ? "Running..." : "Run assessment"}
                </button>
              </div>
            </form>
          )}

          {view === 'assess' && currentState === 'results' && (
            <div>
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-[#0f172a] mb-2">Feature Risk & Accountability Assessment</h1>
                <p className="text-[#64748b]">Internal governance review for AI product features</p>
                <div className="h-px bg-[#e5e5e5] mt-6"></div>
              </div>

              {/* Decision card */}
              <div className="mb-6">
                {demoNotice && (
                  <div role="alert" className="mb-3 border border-[#fcd34d] bg-[#fffbeb] text-[#92400e] rounded p-3 text-sm">
                    {demoNotice}
                  </div>
                )}
                <div className={`flex items-start gap-4 border rounded-lg p-5 ${decisionBadge.card}`}>
                  <span
                    aria-hidden="true"
                    className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-lg font-semibold ${decisionBadge.badge}`}
                  >
                    {decisionBadge.icon}
                  </span>
                  <div>
                    <p className="text-sm text-[#64748b]">Decision for “{featureName || "this feature"}”</p>
                    <p className="text-2xl font-semibold tracking-tight text-[#0f172a]">{decisionBadge.label}</p>
                    {decisionBadge.meaning && <p className="text-[#475569] mt-1">{decisionBadge.meaning}</p>}
                  </div>
                </div>
              </div>

              {/* Decision Rationale */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6">
                <h3 className="text-[#0f172a] mb-4">Decision rationale</h3>
                <ul className="space-y-2 text-[#475569]">
                  {(assessment?.reasons?.length ? assessment.reasons : ["No reasons returned."]).map((r) => (
                    <li key={r}>• {r}</li>
                  ))}
                </ul>
              </div>

              {/* Conditions (if applicable) */}
              {assessment?.conditions?.length ? (
                <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6">
                  <h3 className="text-[#0f172a] mb-4">Conditions</h3>
                  <ul className="space-y-2 text-[#475569]">
                    {assessment.conditions.map((c) => (
                      <li key={c}>• {c}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              {/* Identified Risk Themes */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6">
                <h3 className="text-[#0f172a] mb-4">Identified risk themes</h3>
                {assessment?.risks?.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[#64748b] border-b border-[#e5e5e5]">
                          <th className="py-2 pr-4 font-medium">Risk</th>
                          <th className="py-2 pr-4 font-medium">GDPR principle</th>
                          <th className="py-2 pr-4 font-medium">Impact</th>
                          <th className="py-2 pr-4 font-medium">Likelihood</th>
                          <th className="py-2 pr-4 font-medium">Matched on</th>
                        </tr>
                      </thead>
                      <tbody className="text-[#475569]">
                        {assessment.risks.map((r: RiskItem, idx: number) => (
                          <tr key={`${r.id ?? r.title ?? "risk"}-${idx}`} className="border-b border-[#f1f5f9]">
                            <td className="py-3 pr-4">
                              <div className="text-[#0f172a]">{r.title ?? r.id ?? "Risk"}</div>
                              {r.description ? (
                                <div className="text-[#475569] text-xs mt-1">{r.description}</div>
                              ) : null}
                            </td>
                            <td className="py-3 pr-4">{r.gdpr_principle ?? "—"}</td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${levelChip(r.impact)}`}>{r.impact ?? "—"}</span>
                            </td>
                            <td className="py-3 pr-4">
                              <span className={`px-2 py-0.5 rounded-full text-xs ${levelChip(r.likelihood)}`}>{r.likelihood ?? "—"}</span>
                            </td>
                            <td className="py-3 pr-4">{r.matched_on ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-[#475569] text-sm">No risks returned.</p>
                )}
              </div>

              {/* Generated Accountability Documentation */}
              <div className="bg-white border border-[#e5e5e5] rounded-lg p-6 mb-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-[#0f172a]">Written summary</h3>
                    <p className="text-[#64748b] text-sm">The same assessment as a Markdown document to share or file.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => downloadText("accountability_pack.md", assessment?.markdown ?? "")}
                    className="px-3 py-1.5 text-sm bg-white border border-[#cbd5e1] text-[#475569] rounded hover:bg-[#f8f9fa]"
                  >
                    Download as Markdown
                  </button>
                </div>
                <details className="mt-4">
                  <summary className="cursor-pointer text-[#3b82f6] text-sm">Preview</summary>
                  <div className="mt-3 bg-[#f8f9fa] border border-[#e5e5e5] rounded p-4">
                    {assessment?.markdown ? (
                      <div className="text-[#475569] text-sm prose max-w-none">
                        <ReactMarkdown>{assessment.markdown}</ReactMarkdown>
                      </div>
                    ) : (
                      <pre className="text-[#475569] text-sm whitespace-pre-wrap font-mono">No markdown returned.</pre>
                    )}
                  </div>
                </details>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setCurrentState('form')}
                  className="px-6 py-2.5 bg-[#475569] text-white rounded hover:bg-[#334155] transition-colors"
                >
                  Edit inputs
                </button>
                <button
                  type="button"
                  onClick={resetAll}
                  className="px-6 py-2.5 bg-white border border-[#cbd5e1] text-[#475569] rounded hover:bg-[#f8f9fa] transition-colors"
                >
                  New assessment
                </button>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="mt-12 pt-6 border-t border-[#e5e5e5]">
            <p className="text-[#94a3b8] text-sm">
              This tool supports internal governance workflows and does not replace legal review.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}