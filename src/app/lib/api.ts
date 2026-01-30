import { MOCK_ASSESSMENT } from "./mock";
import type { AssessmentRequest, AssessmentResponse } from "./types";
import { normalizeAssessmentResponse } from "./types";

function getBackendBaseUrl(): string {
  const fromEnv = (import.meta as any).env?.VITE_BACKEND_URL as string | undefined;
  return (fromEnv && fromEnv.trim()) || "http://localhost:8000";
}

export async function assessFeature(payload: AssessmentRequest): Promise<{
  data: AssessmentResponse;
  isDemoFallback: boolean;
}> {
  const baseUrl = getBackendBaseUrl().replace(/\/+$/, "");
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 10_000);

  try {
    const resp = await fetch(`${baseUrl}/assess`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    if (!resp.ok) {
      throw new Error(`Backend returned ${resp.status}`);
    }

    const json = await resp.json();
    return { data: normalizeAssessmentResponse(json), isDemoFallback: false };
  } catch (_e) {
    // Deterministic fallback for demo mode (do not crash UI)
    return { data: MOCK_ASSESSMENT, isDemoFallback: true };
  } finally {
    window.clearTimeout(timeout);
  }
}

