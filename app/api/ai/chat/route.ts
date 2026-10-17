import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth/session";
import { respondToZidduAI, transcribeZidduAudio } from "@/services/ziddu-ai.service";

export const runtime = "nodejs";

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const historySchema = z.array(z.object({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(2000),
})).max(8);
const textRequestSchema = z.object({
  text: z.string().trim().min(1).max(2000),
  history: historySchema.optional().default([]),
});

const acceptedAudioTypes = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ message: "Sign in to use Ziddu AI." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_AUDIO_BYTES + 64 * 1024) {
    return NextResponse.json({ message: "Voice recordings must be under 5 MB." }, { status: 413 });
  }

  try {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      const body = await request.json().catch(() => null);
      const parsed = textRequestSchema.safeParse(body);
      if (!parsed.success) return NextResponse.json({ message: "Enter a message up to 2,000 characters." }, { status: 400 });
      const result = await respondToZidduAI(user.id, parsed.data.history, parsed.data.text);
      return NextResponse.json(result);
    }

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ message: "Send a text message or a voice recording." }, { status: 415 });
    }

    const form = await request.formData();
    const audioEntry = form.get("audio");
    if (!audioEntry || typeof audioEntry === "string" || !("arrayBuffer" in audioEntry)) {
      return NextResponse.json({ message: "Record a voice question before sending." }, { status: 400 });
    }
    if (audioEntry.size === 0 || audioEntry.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ message: "Voice recordings must be between 1 byte and 5 MB." }, { status: 413 });
    }
    const mimeType = audioEntry.type.split(";")[0].trim().toLowerCase();
    if (!acceptedAudioTypes.has(mimeType)) {
      return NextResponse.json({ message: "This voice recording format is not supported on your device." }, { status: 415 });
    }
    const audio = { mimeType, bytes: new Uint8Array(await audioEntry.arrayBuffer()) };
    if (form.get("operation") === "transcribe") {
      return NextResponse.json({ transcript: await transcribeZidduAudio(audio) });
    }

    const historyValue = form.get("history");
    let history: unknown = [];
    if (typeof historyValue === "string") {
      try {
        history = JSON.parse(historyValue);
      } catch {
        return NextResponse.json({ message: "The conversation could not be read. Please try again." }, { status: 400 });
      }
    }
    const parsedHistory = historySchema.safeParse(history);
    if (!parsedHistory.success) return NextResponse.json({ message: "The conversation is too long. Start a new chat and try again." }, { status: 400 });

    const result = await respondToZidduAI(
      user.id,
      parsedHistory.data,
      undefined,
      audio,
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Unable to process Ziddu AI request.", error);
    if (error instanceof Error && error.message.startsWith("Ziddu AI is not configured.")) {
      return NextResponse.json({
        message: "Ziddu AI is not configured. Add GEMINI_API_KEY=your-new-key to the project root .env file, then restart the Next.js server.",
      }, { status: 503 });
    }
    if (error instanceof Error && (
      error.message.startsWith("Gemini ")
      || error.message.startsWith("Ziddu AI could not connect")
      || error.message.startsWith("Voice transcription ")
      || error.message.startsWith("No speech ")
      || error.message.startsWith("The voice transcript ")
    )) {
      return NextResponse.json({ message: error.message }, { status: 503 });
    }
    return NextResponse.json({ message: "Ziddu AI is temporarily unavailable. Please try again." }, { status: 503 });
  }
}
