import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { downsample, encodeWav, splitIntoChunks, TARGET_RATE, transcribePending, type PendingRecording } from "@/lib/voice-audio";
import { readTranscript, TranscriptionError } from "@/lib/transcription-client";

const LANGUAGES: { code: string; label: string }[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en", label: "English" },
  { code: "fr", label: "French" },
  { code: "es", label: "Spanish" },
  { code: "pt", label: "Portuguese" },
  { code: "ar", label: "Arabic" },
  { code: "hi", label: "Hindi" },
  { code: "ur", label: "Urdu" },
  { code: "pa", label: "Punjabi" },
  { code: "tl", label: "Tagalog" },
  { code: "zh", label: "Mandarin" },
  { code: "yue", label: "Cantonese" },
  { code: "so", label: "Somali" },
  { code: "fa", label: "Farsi" },
  { code: "ru", label: "Russian" },
  { code: "uk", label: "Ukrainian" },
  { code: "ti", label: "Tigrinya" },
  { code: "am", label: "Amharic" },
  { code: "om", label: "Oromo" },
  { code: "sw", label: "Swahili" },
  { code: "rw", label: "Kinyarwanda" },
  { code: "ln", label: "Lingala" },
  { code: "ha", label: "Hausa" },
  { code: "tw", label: "Twi" },
  { code: "yo", label: "Yoruba" },
  { code: "ig", label: "Igbo" },
  { code: "bn", label: "Bengali" },
  { code: "gu", label: "Gujarati" },
  { code: "ta", label: "Tamil" },
  { code: "te", label: "Telugu" },
  { code: "ne", label: "Nepali" },
  { code: "ps", label: "Pashto" },
  { code: "ku", label: "Kurdish" },
  { code: "tr", label: "Turkish" },
  { code: "vi", label: "Vietnamese" },
  { code: "ko", label: "Korean" },
  { code: "ja", label: "Japanese" },
  { code: "th", label: "Thai" },
  { code: "km", label: "Khmer" },
  { code: "my", label: "Burmese" },
  { code: "id", label: "Indonesian" },
  { code: "de", label: "German" },
  { code: "it", label: "Italian" },
  { code: "pl", label: "Polish" },
  { code: "ro", label: "Romanian" },
  { code: "nl", label: "Dutch" },
];


function analyzeAudio(chunks: Float32Array[]) {
  let total = 0;
  let sumSquares = 0;
  let clipped = 0;
  for (const c of chunks) {
    total += c.length;
    for (let i = 0; i < c.length; i++) {
      const v = c[i] ?? 0;
      sumSquares += v * v;
      if (Math.abs(v) > 0.99) clipped++;
    }
  }
  const rms = total > 0 ? Math.sqrt(sumSquares / total) : 0;
  const clipRatio = total > 0 ? clipped / total : 0;
  return { rms, clipRatio, totalSamples: total };
}

function recordingQuality(
  rms: number,
  clipRatio: number,
  sampleRate: number,
  totalSamples: number,
) {
  const duration = totalSamples / sampleRate;
  if (duration < 2)
    return { label: "Too short", detail: "Try recording a little longer." };
  if (rms < 0.005 || clipRatio > 0.05)
    return { label: "Poor", detail: "Too quiet or distorted — please re-record." };
  if (rms < 0.03 || clipRatio > 0.005)
    return { label: "Fair", detail: "Okay, but review the transcript carefully." };
  return { label: "Good", detail: "Audio quality looks good." };
}


export function VoiceRecorder({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [starting, setStarting] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(false);
  const [hasPending, setHasPending] = useState(false);
  const pendingRef = useRef<PendingRecording | null>(null);
  const lockRef = useRef(false);
  const mountedRef = useRef(true);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [language, setLanguage] = useState("auto");
  const [quality, setQuality] = useState<{ label: string; detail: string } | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const nodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [recording]);

  // Live audio-quality meter (volume + clipping). Does not predict transcription
  // accuracy — it only warns the worker when the recording may be hard to hear.
  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => {
      const rate = ctxRef.current?.sampleRate ?? 44100;
      const stats = analyzeAudio(chunksRef.current);
      setQuality(recordingQuality(stats.rms, stats.clipRatio, rate, stats.totalSamples));
    }, 500);
    return () => clearInterval(id);
  }, [recording]);


  const cleanup = useCallback(async () => {
    if (nodeRef.current) nodeRef.current.onaudioprocess = null;
    nodeRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    if (ctxRef.current && ctxRef.current.state !== "closed") await ctxRef.current.close();
    nodeRef.current = null;
    sourceRef.current = null;
    streamRef.current = null;
    ctxRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      pendingRef.current = null;
      chunksRef.current = [];
      void cleanup();
    };
  }, [cleanup]);

  async function start() {
    if (lockRef.current || pendingRef.current || ctxRef.current) return;
    lockRef.current = true;
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      streamRef.current = stream;
      const ctx = new AudioContext();
      ctxRef.current = ctx;
      await ctx.resume();
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;
      const node = ctx.createScriptProcessor(4096, 1, 1);
      nodeRef.current = node;
      chunksRef.current = [];
      node.onaudioprocess = (e) => {
        chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
      };
      source.connect(node);
      node.connect(ctx.destination);
      setSeconds(0);
      setQuality(null);
      setRecording(true);

    } catch {
      await cleanup();
      toast.error("Microphone access is needed to record. Allow it in your browser settings.");
    } finally {
      lockRef.current = false;
      if (mountedRef.current) setStarting(false);
    }
  }

  async function runPending() {
    const pending = pendingRef.current;
    if (!pending) return;
    setBusy(true);
    setFailure(null);
    setCanRetry(false);
    try {
      const fullText = await transcribePending(pending, async part => {
        const { data: session } = await supabase.auth.getSession();
        if (!session.session) throw new TranscriptionError("Sign in again to transcribe your recording.", 401, false);
        const form = new FormData();
        form.append("file", new Blob([encodeWav(part)], { type: "audio/wav" }), "recording.wav");
        if (pending.language !== "auto") form.append("language", pending.language);
        const response = await fetch("/api/public/transcribe", { method: "POST", headers: { Authorization: `Bearer ${session.session.access_token}` }, body: form });
        return readTranscript(response);
      }, (part, total) => {
        if (mountedRef.current) setProgress(total > 1 ? `Transcribing part ${part} of ${total}…` : "Transcribing…");
      });
      if (!mountedRef.current) return;
      if (!fullText) {
        pendingRef.current = null;
        setHasPending(false);
        toast.error("No speech was detected in that recording.");
        return;
      }
      onTranscript(fullText);
      pendingRef.current = null;
      setHasPending(false);
      toast.success("Voice note transcribed.");
    } catch (err) {
      if (!mountedRef.current) return;
      const message = err instanceof TypeError
        ? "The connection was interrupted. Your recording has been kept here; check your connection and retry."
        : err instanceof Error ? err.message : "Transcription failed. Your recording has been kept here.";
      setFailure(message);
      setCanRetry(!(err instanceof TranscriptionError) || err.retryable);
      toast.error(message);
    } finally {
      lockRef.current = false;
      if (mountedRef.current) { setBusy(false); setProgress(null); }
    }
  }

  async function stop() {
    if (lockRef.current || !ctxRef.current) return;
    lockRef.current = true;
    setBusy(true);
    const rate = ctxRef.current.sampleRate;
    setRecording(false);
    // Allow the current processing buffer to reach the recording before disconnecting.
    await new Promise<void>(resolve => {
      const node = nodeRef.current;
      if (!node) { resolve(); return; }
      const previous = node.onaudioprocess;
      const timer = setTimeout(resolve, Math.ceil(4096 / rate * 1000) + 100);
      node.onaudioprocess = event => {
        previous?.call(node, event);
        clearTimeout(timer);
        resolve();
      };
    });
    const chunks = chunksRef.current;
    await cleanup();
    chunksRef.current = [];
    if (!mountedRef.current) { lockRef.current = false; return; }
    const samples = downsample(chunks, rate);
    if (samples.length < TARGET_RATE * 0.7) {
      lockRef.current = false;
      setBusy(false);
      toast.error("That recording was too short — please try again.");
      return;
    }
    pendingRef.current = { parts: splitIntoChunks(samples), texts: [], next: 0, language };
    setHasPending(true);
    await runPending();
  }

  function retry() {
    if (lockRef.current || !canRetry || !pendingRef.current) return;
    lockRef.current = true;
    void runPending();
  }

  function discard() {
    if (lockRef.current) return;
    pendingRef.current = null;
    setHasPending(false);
    setFailure(null);
    setCanRetry(false);
  }

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
      <Select value={language} onValueChange={setLanguage} disabled={disabled || recording || busy || starting || hasPending}>
        <SelectTrigger
          className="min-h-[44px] w-full text-sm sm:w-44"
          aria-label="Recording language"
        >
          <SelectValue placeholder="Language" />
        </SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code}>
              {l.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type="button"
        variant={recording ? "destructive" : "secondary"}
        className="min-h-[44px] w-full sm:w-auto"
        disabled={(disabled && !recording) || busy || starting || hasPending}
        onClick={() => void (recording ? stop() : start())}
      >
        {starting ? "Opening microphone…" : busy ? (progress ?? "Transcribing…") : recording ? "Stop recording" : "Record voice note"}
      </Button>
      {recording && quality && (
        <span className="text-xs text-muted-foreground">
          Quality: <span className="font-medium text-foreground">{quality.label}</span> — {quality.detail}
        </span>
      )}
      {recording && (
        <span className="flex items-center gap-2 text-xs text-muted-foreground">
          <span className="h-2 w-2 animate-pulse rounded-full bg-destructive" aria-hidden />
          Recording {mm}:{ss}
        </span>
      )}
      {!recording && !busy && quality && (
        <span className="text-xs text-muted-foreground">
          Recording quality: <span className="font-medium text-foreground">{quality.label}</span> — {quality.detail}
        </span>
      )}
      {failure && (
        <div className="w-full space-y-2" role="alert">
          <p className="text-sm text-destructive">{failure}</p>
          <p className="text-xs text-muted-foreground">Recording kept until you leave this page or discard it.</p>
          <div className="flex flex-wrap gap-2">
            {canRetry && <Button type="button" variant="secondary" disabled={busy || disabled} onClick={retry}>Retry transcription</Button>}
            <Button type="button" variant="outline" disabled={busy} onClick={discard}>Discard recording</Button>
          </div>
        </div>
      )}
      {!recording && !busy && !quality && !failure && (
        <span className="text-xs text-muted-foreground">
          Pick the spoken language for better accuracy — speech is transcribed into your notes below.
        </span>
      )}

    </div>
  );
}
