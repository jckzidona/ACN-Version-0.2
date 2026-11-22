import { it } from "node:test";
import assert from "node:assert/strict";
import { readTranscript, TranscriptionError } from "./transcription-client";

function stream(frames: string[]) {
  const encoder = new TextEncoder();
  return new Response(new ReadableStream({ async start(controller) {
    for (const frame of frames) { await new Promise(r=>setTimeout(r,2)); controller.enqueue(encoder.encode(frame)); }
    controller.close();
  } }), {headers:{"content-type":"text/event-stream"}});
}
it("reads separately arriving metadata and split SSE frames through completion", async()=>{
  assert.equal(await readTranscript(stream([': ping\n\n','data: {"type":"transcript.text.delta","delta":"Hello"}\n\n','data: {"type":"transcript.text.','done","text":"Hello world"}\n\n'])),"Hello world");
});
it("never accepts partial text as a complete transcription",async()=>{
  await assert.rejects(readTranscript(stream(['data: {"type":"transcript.text.delta","delta":"Partial"}\n\n'])),/before completion/);
});
it("surfaces terminal denial events without replaying",async()=>{
  await assert.rejects(readTranscript(stream(['data: {"type":"error","error":{"message":"Provider access denied"}}\n\n'])),(e:unknown)=>e instanceof TranscriptionError && !e.retryable && e.message==="Provider access denied");
});