import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { transcriptionFailure, retryDelay } from "./transcription-policy";
import { CHUNK_SAMPLES, downsample, encodeWav, splitIntoChunks, transcribePending } from "./voice-audio";

describe("transcription reliability", () => {
  it("never retries terminal statuses or explicit permanent failures", () => {
    for (const status of [400,401,402,403,404,302]) assert.equal(transcriptionFailure(status, {}).retryable, false);
    assert.equal(transcriptionFailure(503, { props: { retryable: false } }).retryable, false);
    assert.equal(transcriptionFailure(503, { error: { message: "Provider account disabled" } }).retryable, false);
  });
  it("backs off transient errors and respects Retry-After", () => {
    assert.equal(transcriptionFailure(503, {}).retryable, true);
    assert.equal(transcriptionFailure(429, {}).retryable, true);
    assert.equal(retryDelay("12", 0), 12000);
    assert.equal(retryDelay(null, 1, 0, 0), 2000);
  });
  it("preserves safe denial and credit messages", () => {
    assert.equal(transcriptionFailure(403, {error:{message:"Provider access denied"}}).providerDenied, true);
    assert.equal(transcriptionFailure(402, {message:"Top up workspace credits"}).message, "Top up workspace credits");
  });
  it("keeps the short tail of a long recording", () => {
    const input = new Float32Array(CHUNK_SAMPLES + 100); input[input.length - 1] = 0.5;
    const parts = splitIntoChunks(input);
    assert.equal(parts.reduce((n,p)=>n+p.length,0), input.length);
    assert.equal(parts.at(-1)?.at(-1), 0.5);
    assert.ok(encodeWav(parts[0] ?? input).length < 14_000_000);
  });
  it("encodes the correct sample rate even on low-rate devices", () => {
    const samples = downsample([new Float32Array(8000)], 8000);
    assert.equal(samples.length, 16000);
    const wav = encodeWav(samples);
    assert.equal(new DataView(wav.buffer).getUint32(24,true),16000);
  });
  it("retries only the failed part without losing previous transcripts", async () => {
    const pending = {parts:[new Float32Array([1]),new Float32Array([2])],texts:[] as string[],next:0,language:"en"};
    const calls:number[]=[]; let fail=true;
    const send=async(p:Float32Array)=>{calls.push(p[0] ?? 0); if(p[0]===2 && fail) throw new Error("503"); return p[0]===1?"First":"Last";};
    await assert.rejects(transcribePending(pending,send,()=>{})); fail=false;
    assert.equal(await transcribePending(pending,send,()=>{}),"First\n\nLast");
    assert.deepEqual(calls,[1,2,2]);
  });
});