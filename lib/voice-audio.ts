export const TARGET_RATE = 16000;
export const CHUNK_SAMPLES = 240 * TARGET_RATE;

export function downsample(chunks: Float32Array[], sourceRate: number): Float32Array {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.length; }
  const ratio = sourceRate / TARGET_RATE;
  const output = new Float32Array(Math.ceil(total / ratio));
  for (let i = 0; i < output.length; i++) output[i] = merged[Math.min(total - 1, Math.floor(i * ratio))] ?? 0;
  return output;
}

export function splitIntoChunks(samples: Float32Array): Float32Array[] {
  const parts: Float32Array[] = [];
  for (let start = 0; start < samples.length; start += CHUNK_SAMPLES) parts.push(samples.subarray(start, start + CHUNK_SAMPLES));
  // Keep a short final tail, attached to the preceding complete recording.
  const last = parts.at(-1);
  if (parts.length > 1 && last && last.length < TARGET_RATE * 0.7) {
    const prior = parts.at(-2);
    if (prior) parts.splice(parts.length - 2, 2, samples.subarray(samples.length - prior.length - last.length));
  }
  return parts;
}

export function encodeWav(samples: Float32Array): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const v = new DataView(buffer);
  const tag = (o: number, text: string) => { for (let i = 0; i < text.length; i++) v.setUint8(o + i, text.charCodeAt(i)); };
  tag(0, "RIFF"); v.setUint32(4, 36 + samples.length * 2, true); tag(8, "WAVE"); tag(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, TARGET_RATE, true); v.setUint32(28, TARGET_RATE * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true);
  tag(36, "data"); v.setUint32(40, samples.length * 2, true);
  samples.forEach((value, i) => { const s = Math.max(-1, Math.min(1, value)); v.setInt16(44 + i * 2, s * (s < 0 ? 32768 : 32767), true); });
  return new Uint8Array(buffer);
}

export type PendingRecording = { parts: Float32Array[]; texts: string[]; next: number; language: string };
export async function transcribePending(pending: PendingRecording, transcribe: (part: Float32Array) => Promise<string>, progress: (part: number, total: number) => void): Promise<string> {
  while (pending.next < pending.parts.length) {
    const part = pending.parts[pending.next];
    if (!part) throw new Error("Recording part is missing.");
    progress(pending.next + 1, pending.parts.length);
    const text = (await transcribe(part)).trim();
    pending.texts.push(text); pending.next++;
  }
  return pending.texts.filter(Boolean).join("\n\n");
}