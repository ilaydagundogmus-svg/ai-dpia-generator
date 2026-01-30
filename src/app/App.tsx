import { useMemo, useState, type FormEvent } from "react";
import ReactMarkdown from "react-markdown";

import { assessFeature } from "./lib/api";
import type { AssessmentRequest, AssessmentResponse, Decision, RiskItem } from "./lib/types";

type AssessmentState = 'form' | 'results';

function toDecisionBadge(decision: string): { label: string; className: string } {
  const normalized = decision.toUpperCase().replace(/\s+/g, "_");
  const d = normalized as Decision;

  if (d === "SHIP") return { label: "SHIP", className: "bg-[#dcfce7] text-[#166534]" };
  if (d === "SHIP_WITH_CONDITIONS")
    return { label: "SHIP WITH CONDITIONS", className: "bg-[#fef3c7] text-[#92400e]" };
  if (d === "ESCALATE") return { label: "ESCALATE", className: "bg-[#e5e7eb] text-[#374151]" };

  return { label: decision || "N/A", className: "bg-[#e5e7eb] text-[#374151]" };
}

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

  const decisionBadge = useMemo(() => {
    const d = assessment?.decision ? String(assessment.decision) : "N/A";
    return toDecisionBadge(d);
  }, [assessment?.decision]);

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
      if (isDemoFallback) {
        setDemoNotice("Backend not available — showing demo output");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#fafafa]">
      {/* Left Sidebar */}
      <aside className="w-64 bg-white border-r border-[#e5e5e5] flex-shrink-0">
        <div className="p-6">
          <h2 className="text-[#1a1a1a] tracking-tight">AI Feature Risk & Accountability Toolkit</h2>
        </div>
        <nav className="px-4 space-y-1">
          <div className="px-3 py-2 text-[#0f172a] bg-[#f8f9fa] rounded">
            New Assessment
          </div>
          <div className="px-3 py-2 text-[#64748b] hover:bg-[#f8f9fa] rounded cursor-pointer">
            Previous Assessments
          </div>
          <div className="px-3 py-2 text-[#64748b] hover:bg-[#f8f9fa] rounded cursor-pointer">
            Documentation
          </div>
        </nav>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-8">
          {currentState === 'form' && (
            <form onSubmit={handleSubmit}>
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-[#0f172a] mb-2">Feature Risk & Accountability Assessment</h1>
                <p className="text-[#64748b]">Internal governance review for AI product features</p>
                <div className="h-px bg-[#e5e5e5] mt-6"></div>
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
                      Feature name
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
                      Feature description
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
                
                <div className="grid grid-cols-2 gap-6">
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
                      {['Personal identifiers', 'Behavioral data', 'Biometric data', 'Special category data'].map((option) => (
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
                      {['Collection', 'Storage', 'Analysis', 'Automated decision-making'].map((option) => (
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
                      onChange={(e) => setRetention(e.target.value)}
                      className="w-full px-3 py-2 border border-[#cbd5e1] rounded bg-white text-[#0f172a] focus:outline-none focus:ring-2 focus:ring-[#3b82f6] focus:border-transparent"
                    />
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

          {currentState === 'results' && (
            <div>
              {/* Page Header */}
              <div className="mb-8">
                <h1 className="text-[#0f172a] mb-2">Feature Risk & Accountability Assessment</h1>
                <p className="text-[#64748b]">Internal governance review for AI product features</p>
                <div className="h-px bg-[#e5e5e5] mt-6"></div>
              </div>

              {/* Decision Badge */}
              <div className="mb-6">
                {demoNotice && (
                  <div className="mb-3 border border-[#e2e8f0] bg-white text-[#475569] rounded p-3 text-sm">
                    {demoNotice}
                  </div>
                )}
                <div className={`inline-flex items-center px-4 py-2 rounded ${decisionBadge.className}`}>
                  <span className="tracking-wide">DECISION: {decisionBadge.label}</span>
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
                            <td className="py-3 pr-4">{r.impact ?? "—"}</td>
                            <td className="py-3 pr-4">{r.likelihood ?? "—"}</td>
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
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-[#0f172a]">Generated accountability documentation</h3>
                  <button
                    type="button"
                    onClick={() => downloadText("accountability_pack.md", assessment?.markdown ?? "")}
                    className="text-[#3b82f6] hover:underline text-sm"
                  >
                    Download as Markdown
                  </button>
                </div>
                <div className="bg-[#f8f9fa] border border-[#e5e5e5] rounded p-4 max-h-96 overflow-y-auto">
                  {assessment?.markdown ? (
                    <div className="text-[#475569] text-sm prose max-w-none">
                      <ReactMarkdown>{assessment.markdown}</ReactMarkdown>
                    </div>
                  ) : (
                    <pre className="text-[#475569] text-sm whitespace-pre-wrap font-mono">No markdown returned.</pre>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => setCurrentState('form')}
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