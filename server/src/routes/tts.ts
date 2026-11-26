import { Router, type Request, type Response } from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { z } from "zod";

const router = Router();

const ttsSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(3000),
  language: z.string().trim().max(64).default("hi-en"),
});

const HINGLISH_HINT_REGEX =
  /\b(aaj|kal|mein|main|hain|hai|hoon|karte|karna|kya|kaise|bhai|yaar|theek|abhi|subah|shaam|raat|baat|samajh|bolo|chalo|accha|nahi|haan|kitne|baje|wala|wali|wale|hum|tum|aap|woh|yeh|liye|saath|par|aur|lekin|kyunki)\b/i;

function pickNeuralVoice(text: string, language: string): string {
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const looksHinglish = HINGLISH_HINT_REGEX.test(text);

  if (
    hasDevanagari ||
    looksHinglish ||
    language === "hi-IN" ||
    language === "hi-en" ||
    language === "multilingual"
  ) {
    return "hi-IN-SwaraNeural";
  }

  switch (language) {
    case "en-IN":
      return "en-IN-NeerjaNeural";
    case "en-US":
      return "en-US-AriaNeural";
    case "ta-IN":
      return "ta-IN-PallaviNeural";
    case "te-IN":
      return "te-IN-ShrutiNeural";
    case "kn-IN":
      return "kn-IN-SapnaNeural";
    case "bn-IN":
      return "bn-IN-TanishaaNeural";
    default:
      return "hi-IN-SwaraNeural";
  }
}

router.post("/", async (req: Request, res: Response) => {
  const parsed = ttsSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { text, language } = parsed.data;
  const voice = pickNeuralVoice(text, language);
  const tts = new MsEdgeTTS();

  try {
    await tts.setMetadata(
      voice,
      OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3
    );
    const { audioStream } = tts.toStream(text);
    const chunks: Buffer[] = [];

    for await (const chunk of audioStream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const audioBuffer = Buffer.concat(chunks);
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Content-Length", String(audioBuffer.length));
    res.setHeader("X-TTS-Voice", voice);
    res.send(audioBuffer);
  } catch (err) {
    console.error("[api:tts] Neural TTS synthesis failed:", err);
    res.status(502).json({ error: "Text-to-speech synthesis failed" });
  } finally {
    tts.close();
  }
});

export default router;

