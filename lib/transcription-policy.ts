export type TranscriptionFailure = { status: number; message: string; retryable: boolean; providerDenied: boolean };

export function transcriptionFailure(status: number, payload: unknown): TranscriptionFailure {
  const body = payload && typeof payload === "object" ? payload as Record<string, unknown> : {};
  const error = body["error"] && typeof body["error"] === "object" ? body["error"] as Record<string, unknown> : body;
  const props = body["props"] && typeof body["props"] === "object" ? body["props"] as Record<string, unknown> : {};
  const type = typeof error["type"] === "string" ? error["type"] : "";
  const supplied = typeof error["message"] === "string" ? error["message"] : typeof body["message"] === "string" ? body["message"] : "";
  const message = supplied || (status === 429 ? "Voice transcription is busy. Please try again later." : "Voice transcription is temporarily unavailable. Your recording has been kept here.");
  const configuration = /account|configuration|billing|not registered/i.test(supplied);
  const providerDenied = status === 403 && !["credit_limit_reached", "model_vendor_not_enabled", "provider_not_available_in_region", "model_requires_retention_consent", "ai_disabled"].includes(type);
  return { status, message, providerDenied, retryable: props["retryable"] !== false && !configuration && (status === 429 || (status >= 500 && status <= 599)) };
}

export function retryDelay(retryAfter: string | null, attempt: number, now = Date.now(), random = Math.random()): number {
  if (retryAfter) {
    const seconds = Number(retryAfter);
    const duration = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(retryAfter) - now;
    if (Number.isFinite(duration) && duration > 0) return duration;
  }
  return 1000 * 2 ** attempt + Math.floor(random * 500);
}