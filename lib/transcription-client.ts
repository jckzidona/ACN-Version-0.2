import { createParser } from "eventsource-parser";

export class TranscriptionError extends Error {
  constructor(message: string, readonly status: number, readonly retryable: boolean) { super(message); }
}

export async function readTranscript(response: Response): Promise<string> {
  if (!response.ok) {
    const body = await response.json().catch(() => ({})) as { message?: string; retryable?: boolean };
    throw new TranscriptionError(body.message ?? "Transcription failed. Your recording has been kept here.", response.status, body.retryable === true);
  }
  if (!response.headers.get("content-type")?.includes("text/event-stream")) {
    const json = await response.json() as { text?: string };
    if (typeof json.text !== "string") throw new Error("The transcription response was incomplete. Your recording has been kept here.");
    return json.text.trim();
  }
  const reader = response.body?.getReader();
  if (!reader) throw new Error("The transcription response was empty.");
  const decoder = new TextDecoder(); let final: string | undefined; let failure: Error | undefined;
  const parser = createParser({ onEvent(event) {
    if (!event.data || event.data === "[DONE]") return;
    try {
      const data = JSON.parse(event.data) as { type?: string; text?: string; error?: { message?: string }; message?: string };
      const type = data.type ?? event.event;
      if (type === "transcript.text.done" && typeof data.text === "string") final = data.text;
      if (type === "error" || data.error) failure = new TranscriptionError(data.error?.message ?? data.message ?? "Transcription could not be completed.", 403, false);
    } catch { failure = new Error("The transcription response was damaged. Your recording has been kept here."); }
  } });
  try {
    while (true) { const chunk = await reader.read(); if (chunk.done) break; parser.feed(decoder.decode(chunk.value, { stream: true })); if (failure) { await reader.cancel(); throw failure; } }
    parser.feed(decoder.decode());
  } finally { reader.releaseLock(); }
  if (failure) throw failure;
  if (final === undefined) throw new Error("The transcription connection ended before completion. Your recording has been kept here.");
  return final.trim();
}