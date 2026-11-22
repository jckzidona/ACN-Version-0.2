import { createFileRoute } from "@tanstack/react-router";
import { handleTranscription } from "@/lib/transcription.server";

export const Route = createFileRoute("/api/public/transcribe")({
  server: { handlers: { POST: ({ request }) => handleTranscription(request) } },
});