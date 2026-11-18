import type { AnalyzeRequest, AnalyzeResult, Place, Preset } from "@/types";

/** API origin. Trailing slashes (and a stray "/api" suffix) are removed so paths never double up. */
export function normalizeBase(raw: string | undefined): string {
  return (raw ?? "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/api$/, "");
}

const BASE = normalizeBase(import.meta.env.VITE_API_URL as string | undefined);

/** Health endpoint: opening it in a tab wakes the sleeping backend. */
export const HEALTH_URL = `${BASE}/api/health`;

export class ApiError extends Error {}

async function parse<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const b = body as { error?: string } | Record<string, unknown> | null;
    const direct = b && typeof (b as { error?: string }).error === "string" ? (b as { error: string }).error : null;
    throw new ApiError(direct ?? firstValidationMessage(b) ?? `Request failed (${res.status})`);
  }
  return body as T;
}

/** DRF validation errors look like {field: ["msg"]} or {field: {sub: ["msg"]}}. */
function firstValidationMessage(b: unknown): string | null {
  if (!b || typeof b !== "object") return null;
  for (const [field, v] of Object.entries(b as Record<string, unknown>)) {
    if (Array.isArray(v) && typeof v[0] === "string") return field === "non_field_errors" ? v[0] : `${field}: ${v[0]}`;
    const nested = firstValidationMessage(v);
    if (nested) return nested;
  }
  return null;
}

export async function geocode(q: string, signal: AbortSignal): Promise<Place[]> {
  const res = await fetch(`${BASE}/api/geocode?q=${encodeURIComponent(q)}`, { signal });
  return (await parse<{ results: Place[] }>(res)).results;
}

export async function getPresets(signal?: AbortSignal): Promise<Preset[]> {
  const res = await fetch(`${BASE}/api/presets`, { signal });
  return (await parse<{ presets: Preset[] }>(res)).presets;
}

export async function analyze(req: AnalyzeRequest, signal?: AbortSignal): Promise<AnalyzeResult> {
  const res = await fetch(`${BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
    signal,
  });
  return parse<AnalyzeResult>(res);
}
