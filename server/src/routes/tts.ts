import { Router, type Request, type Response } from "express";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";
import { z } from "zod";

const router = Router();

const ttsSchema = z.object({
  text: z.string().trim().min(1, "Text is required").max(3000),
  language: z.string().trim().max(64).default("hi-en"),
});

const HINGLISH_HINT_REGEX =
  /\b(aaj|kal|mein|main|hain|hai|hoon|karte|karna|kya|kaise|bhai|yaar|theek|abhi|subah|shaam|raat|baat|samajh|bolo|chalo|accha|nahi|haan|kitne|baje|wala|wali|wale|hum|tum|aap|woh|yeh|liye|saath|lekin|kyunki)\b/i;

function pickNeuralVoice(text: string, language: string): string {
  // 1. Native Unicode script always takes precedence so regional text is spoken accurately
  if (/[\u0C80-\u0CFF]/.test(text)) return "kn-IN-SapnaNeural";
  if (/[\u0B80-\u0BFF]/.test(text)) return "ta-IN-PallaviNeural";
  if (/[\u0C00-\u0C7F]/.test(text)) return "te-IN-ShrutiNeural";
  if (/[\u0D00-\u0D7F]/.test(text)) return "ml-IN-SobhanaNeural";
  if (/[\u0A80-\u0AFF]/.test(text)) return "gu-IN-DhwaniNeural";
  if (/[\u0980-\u09FF]/.test(text)) return "bn-IN-TanishaaNeural";
  if (/[\u0900-\u097F]/.test(text)) {
    return language === "mr-IN" ? "mr-IN-AarohiNeural" : "hi-IN-SwaraNeural";
  }

  // 2. Explicit regional or English language selection
  switch (language) {
    case "kn-IN":
      return "kn-IN-SapnaNeural";
    case "ta-IN":
      return "ta-IN-PallaviNeural";
    case "te-IN":
      return "te-IN-ShrutiNeural";
    case "ml-IN":
      return "ml-IN-SobhanaNeural";
    case "mr-IN":
      return "mr-IN-AarohiNeural";
    case "gu-IN":
      return "gu-IN-DhwaniNeural";
    case "bn-IN":
      return "bn-IN-TanishaaNeural";
    case "hi-IN":
      return "hi-IN-SwaraNeural";
    case "en-US":
      return "en-US-AriaNeural";
    case "en-IN":
      return HINGLISH_HINT_REGEX.test(text)
        ? "hi-IN-SwaraNeural"
        : "en-IN-NeerjaNeural";
    case "hi-en":
    case "multilingual":
    default:
      return HINGLISH_HINT_REGEX.test(text) || language === "hi-en"
        ? "hi-IN-SwaraNeural"
        : "en-IN-NeerjaNeural";
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
