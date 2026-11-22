import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { loadContext } from "./authz";
import { retryDelay, transcriptionFailure } from "./transcription-policy";

const MODELS = ["google/gemini-3.5-transcribe", "openai/gpt-transcribe"];
const MAX_BODY = 8_000_000;
const errorResponse = (message: string, status: number, retryable = false) => Response.json({ message, retryable }, { status });

export async function handleTranscription(request: Request): Promise<Response> {
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const url = process.env["SUPABASE_URL"];
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!key || !url || !apiKey) return errorResponse("Voice transcription is not configured for this deployment.", 503);
  const authorization = request.headers.get("authorization") ?? "";
  if (!authorization.startsWith("Bearer ")) return errorResponse("Sign in again to transcribe your recording.", 401);
  const token = authorization.slice(7);
  const db = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization }, fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await db.auth.getClaims(token);
  if (error || !data?.claims.sub) return errorResponse("Sign in again to transcribe your recording.", 401);
  try { await loadContext(db, data.claims.sub); } catch { return errorResponse("Your account must be active and belong to an organization to transcribe recordings.", 403); }

  if (!request.headers.get("content-type")?.startsWith("multipart/form-data")) return errorResponse("Upload a complete audio recording.", 400);
  if (Number(request.headers.get("content-length")) > MAX_BODY) return errorResponse("This recording part is too large.", 413);
  const reader = request.body?.getReader();
  if (!reader) return errorResponse("The recording is empty.", 400);
  const chunks: Uint8Array[] = []; let bytes = 0;
  try {
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      bytes += result.value.length;
      if (bytes > MAX_BODY) { await reader.cancel(); return errorResponse("This recording part is too large.", 413); }
      chunks.push(result.value);
    }
  } finally { reader.releaseLock(); }
  const buffer = new Uint8Array(bytes); let offset = 0;
  for (const chunk of chunks) { buffer.set(chunk, offset); offset += chunk.length; }
  let form: FormData;
  try { form = await new Response(buffer, { headers: { "content-type": request.headers.get("content-type") ?? "" } }).formData(); }
  catch { return errorResponse("The recording upload was incomplete. Please try again.", 400); }
  const file = form.get("file");
  if (!(file instanceof File) || file.type !== "audio/wav" || file.size < 2048 || file.size > 7_800_000) return errorResponse("Upload a complete, non-empty WAV recording.", 400);
  const header = new DataView(await file.slice(0, 44).arrayBuffer());
  if (header.getUint32(0) !== 0x52494646 || header.getUint32(8) !== 0x57415645 || header.getUint32(40, true) + 44 !== file.size) return errorResponse("The recording is incomplete or damaged. Please record again.", 400);
  const language = form.get("language");
  if (language && (typeof language !== "string" || !/^[a-z]{2,3}$/.test(language))) return errorResponse("Select a supported recording language.", 400);

  // This operational circuit breaker is privileged, never exposed to browser queries.
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data: blocks, error: blockError } = await supabaseAdmin.from("transcription_provider_blocks").select("model,message,status").in("model", MODELS);
  if (blockError) return errorResponse("Voice transcription access could not be checked. Your recording has been kept here.", 503);
  const block = blocks?.[0];
  if (block) return errorResponse(block.message, block.status);

  let runId: string | null = null;
  for (let modelIndex = 0; modelIndex < MODELS.length; modelIndex++) {
    const model = MODELS[modelIndex];
    if (!model) continue;
    for (let attempt = 0; attempt < 3; attempt++) {
      const upload = new FormData();
      upload.append("model", model); upload.append("file", file, "recording.wav");
      upload.append("response_format", "json"); upload.append("stream", "true");
      if (typeof language === "string" && language) upload.append("language", language);
      const headers = new Headers({ Authorization: `Bearer ${apiKey}`, "X-Lovable-AIG-SDK": "fetch" });
      if (runId) headers.set("X-Lovable-AIG-Run-ID", runId);
      let response: Response;
      try { response = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", { method: "POST", headers, body: upload, signal: request.signal }); }
      catch { return errorResponse("The transcription connection was interrupted. Your recording has been kept here.", request.signal.aborted ? 499 : 503); }
      runId ??= response.headers.get("X-Lovable-AIG-Run-ID");
      if (response.ok) {
        const outgoing = new Headers({ "Content-Type": response.headers.get("Content-Type") ?? "text/event-stream", "Cache-Control": "no-cache, no-transform" });
        response.headers.forEach((value, name) => { if (name.toLowerCase().startsWith("x-lovable-aig-")) outgoing.set(name, value); });
        return new Response(response.body, { status: response.status, headers: outgoing });
      }
      const raw = await response.text();
      let payload: unknown;
      try { payload = JSON.parse(raw); } catch { payload = {}; }
      const failure = transcriptionFailure(response.status, payload);
      if (failure.providerDenied) {
        const { error: persistError } = await supabaseAdmin.from("transcription_provider_blocks").upsert({ model, status: response.status, message: failure.message });
        if (persistError) console.error("Could not persist transcription access block", persistError.code);
      }
      console.warn("transcription request failed", { status: response.status, model, attempt, runId });
      if (!failure.retryable) return errorResponse(failure.message, failure.status);
      // Rate limits share one workspace budget; switching models would bypass backoff.
      if (attempt === 2 && (response.status === 429 || modelIndex === MODELS.length - 1)) return errorResponse(failure.message, failure.status, true);
      await new Promise(resolve => setTimeout(resolve, retryDelay(response.headers.get("Retry-After"), attempt)));
    }
  }
  return errorResponse("Voice transcription is temporarily unavailable. Your recording has been kept here.", 503, true);
}