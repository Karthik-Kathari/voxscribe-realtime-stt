import {
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  type LiveServerMessage,
} from "@google/genai";
import WebSocket, { type RawData } from "ws";
import { config } from "../config.js";

const REGIONAL_LANGUAGE_PROMPTS: Record<string, string> = {
  "kn-IN":
    "Kannada (kn-IN) in native Kannada script (ಕನ್ನಡ), keeping any English words in Latin script",
  "ta-IN":
    "Tamil (ta-IN) in native Tamil script (தமிழ்), keeping any English words in Latin script",
  "te-IN":
    "Telugu (te-IN) in native Telugu script (తెలుగు), keeping any English words in Latin script",
  "ml-IN":
    "Malayalam (ml-IN) in native Malayalam script (മലയാളം), keeping any English words in Latin script",
  "mr-IN":
    "Marathi (mr-IN) in native Devanagari script (मराठी), keeping any English words in Latin script",
  "gu-IN":
    "Gujarati (gu-IN) in native Gujarati script (ગુજરાતી), keeping any English words in Latin script",
  "bn-IN":
    "Bengali (bn-IN) in native Bengali script (বাংলা), keeping any English words in Latin script",
  "hi-IN":
    "Hindi (hi-IN) in native Devanagari script (हिन्दी), keeping any English words in Latin script",
};

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function rawDataToBuffer(data: RawData): Buffer {
  if (Buffer.isBuffer(data)) return data;
  if (Array.isArray(data)) return Buffer.concat(data);
  return Buffer.from(data);
}

function pcm16ToWav(pcm: Buffer, sampleRate = 16000): Buffer {
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // PCM chunk size
  header.writeUInt16LE(1, 20); // PCM format
  header.writeUInt16LE(1, 22); // Mono
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28); // Byte rate
  header.writeUInt16LE(2, 32); // Block align
  header.writeUInt16LE(16, 34); // Bits per sample
  header.write("data", 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

function computePcmRms(pcm: Buffer): number {
  const sampleCount = Math.floor(pcm.length / 2);
  if (sampleCount === 0) return 0;
  let sumSq = 0;
  for (let i = 0; i < sampleCount; i++) {
    const sample = pcm.readInt16LE(i * 2) / 32768;
    sumSq += sample * sample;
  }
  return Math.sqrt(sumSq / sampleCount);
}

/**
 * Handles a browser WebSocket connection for real-time speech-to-text.
 * Routes:
 *  - engine=whisper -> Self-hosted open-source Faster-Whisper microservice
 *  - engine=gemini + regional Indian language (kn-IN, ta-IN, te-IN, ml-IN, mr-IN, gu-IN, bn-IN, hi-IN)
 *      -> Energy-VAD chunked streaming via gemini-3.5-transcribe with explicit language/script prompt
 *  - engine=gemini + hi-en / multilingual / en-IN / en-US
 *      -> Gemini Live 3.1 API (gemini-3.1-flash-live-preview) bidirectional WebSocket
 */
export async function handleTranscribeSocket(
  clientWs: WebSocket,
  engine: string,
  language: string
): Promise<void> {
  if (engine === "whisper") {
    await bridgeWhisperSocket(clientWs, language);
    return;
  }

  if (language in REGIONAL_LANGUAGE_PROMPTS) {
    await bridgeRegionalGeminiTranscribe(clientWs, language);
    return;
  }

  await bridgeGeminiLiveSocket(clientWs, language);
}

/**
 * Dedicated streaming transcription for regional Indian languages (Kannada, Tamil,
 * Telugu, Malayalam, Marathi, Gujarati, Bengali, Hindi) using Gemini's
 * specialized transcription model (`gemini-3.5-transcribe`) + server-side VAD.
 */
async function bridgeRegionalGeminiTranscribe(
  clientWs: WebSocket,
  language: string
): Promise<void> {
  if (!config.geminiApiKey) {
    sendJson(clientWs, {
      type: "error",
      message:
        "GEMINI_API_KEY is not configured on the server. Add your key to .env or switch to Browser Speech.",
    });
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  const langPrompt = REGIONAL_LANGUAGE_PROMPTS[language];
  let closed = false;
  let speechChunks: Buffer[] = [];
  let speechBytes = 0;
  let hasSpeechEnergy = false;
  let silentMs = 0;
  let flushInFlight = Promise.resolve();

  const BYTES_PER_MS = 32; // 16kHz * 2 bytes / 1000ms
  const MIN_SPEECH_BYTES = 16000 * 2 * 0.4; // 400ms minimum audio
  const MAX_CHUNK_BYTES = 16000 * 2 * 2.4; // Flush rolling window every 2.4s
  const SILENCE_FLUSH_MS = 480;
  const VAD_RMS_THRESHOLD = 0.012;

  const flushSpeech = (isStop = false) => {
    if (speechBytes < MIN_SPEECH_BYTES || !hasSpeechEnergy) {
      speechChunks = [];
      speechBytes = 0;
      hasSpeechEnergy = false;
      silentMs = 0;
      if (isStop) {
        sendJson(clientWs, { type: "done" });
      }
      return;
    }

    const pcm = Buffer.concat(speechChunks);
    speechChunks = [];
    speechBytes = 0;
    hasSpeechEnergy = false;
    silentMs = 0;

    const wav = pcm16ToWav(pcm);

    flushInFlight = flushInFlight.then(async () => {
      if (closed && !isStop) return;
      try {
        const resp = await ai.models.generateContent({
          model: "gemini-3.5-transcribe",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    mimeType: "audio/wav",
                    data: wav.toString("base64"),
                  },
                },
                {
                  text: `Transcribe this spoken audio verbatim. The language is ${langPrompt}. Output ONLY the exact words spoken in the proper native script without commentary or translation.`,
                },
              ],
            },
          ],
        });

        const text = resp.text?.trim() || "";
        if (text && clientWs.readyState === WebSocket.OPEN) {
          sendJson(clientWs, {
            type: "transcript",
            text,
            isFinal: true,
            language,
          });
        }
      } catch (err) {
        console.error("[ws:regional-transcribe] Error:", err);
        if (clientWs.readyState === WebSocket.OPEN) {
          sendJson(clientWs, {
            type: "error",
            message:
              err instanceof Error
                ? err.message
                : "Regional transcription failed",
          });
        }
      } finally {
        if (isStop && clientWs.readyState === WebSocket.OPEN) {
          sendJson(clientWs, { type: "done" });
          clientWs.close();
        }
      }
    });
  };

  sendJson(clientWs, {
    type: "ready",
    engine: `gemini-3.5-transcribe (${language})`,
  });

  clientWs.on("message", (data, isBinary) => {
    if (closed) return;

    if (isBinary) {
      const buf = rawDataToBuffer(data);
      const rms = computePcmRms(buf);
      const frameMs = Math.round(buf.length / BYTES_PER_MS);

      if (rms >= VAD_RMS_THRESHOLD) {
        hasSpeechEnergy = true;
        silentMs = 0;
      } else if (hasSpeechEnergy) {
        silentMs += frameMs;
      }

      if (hasSpeechEnergy || speechBytes > 0) {
        speechChunks.push(buf);
        speechBytes += buf.length;
      }

      if (
        (hasSpeechEnergy && silentMs >= SILENCE_FLUSH_MS) ||
        speechBytes >= MAX_CHUNK_BYTES
      ) {
        flushSpeech(false);
      }
      return;
    }

    try {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === "stop") {
        flushSpeech(true);
      }
    } catch {
      // ignore malformed control frame
    }
  });

  clientWs.on("close", () => {
    closed = true;
  });
}

async function bridgeGeminiLiveSocket(
  clientWs: WebSocket,
  language: string
): Promise<void> {
  if (!config.geminiApiKey) {
    sendJson(clientWs, {
      type: "error",
      message:
        "GEMINI_API_KEY is not configured on the server. Add your free Google AI Studio key to .env or switch to Browser Speech.",
    });
    clientWs.close();
    return;
  }

  const ai = new GoogleGenAI({ apiKey: config.geminiApiKey });
  let closed = false;
  let sessionReady = false;
  let session: Awaited<ReturnType<typeof ai.live.connect>> | null = null;
  const pendingAudioChunks: Buffer[] = [];

  const sendPcmToSession = (buf: Buffer) => {
    if (!session || closed) return;
    session.sendRealtimeInput({
      audio: {
        data: buf.toString("base64"),
        mimeType: "audio/pcm;rate=16000",
      },
    });
  };

  clientWs.on("message", (data, isBinary) => {
    if (closed) return;

    if (isBinary) {
      const buf = rawDataToBuffer(data);
      if (session && sessionReady) {
        sendPcmToSession(buf);
      } else if (pendingAudioChunks.length < 150) {
        pendingAudioChunks.push(buf);
      }
      return;
    }

    try {
      const msg = JSON.parse(data.toString()) as { type?: string };
      if (msg.type === "stop" && session) {
        session.sendRealtimeInput({ audioStreamEnd: true });
      }
    } catch {
      // ignore malformed control frame
    }
  });

  clientWs.on("close", () => {
    closed = true;
    pendingAudioChunks.length = 0;
    try {
      session?.close();
    } catch {
      // ignore close errors
    }
  });

  const languageHint =
    language === "hi-en" || language === "multilingual"
      ? "The speaker is speaking Indian English mixed with Hindi (Hinglish) or other Indian languages. Transcribe every word verbatim with accurate spelling."
      : `The primary spoken language is ${language}. Transcribe verbatim.`;

  try {
    session = await ai.live.connect({
      model: config.geminiLiveModel,
      config: {
        responseModalities: [Modality.AUDIO],
        inputAudioTranscription: {},
        realtimeInputConfig: {
          automaticActivityDetection: {
            startOfSpeechSensitivity: StartSensitivity.START_SENSITIVITY_HIGH,
            endOfSpeechSensitivity: EndSensitivity.END_SENSITIVITY_HIGH,
            prefixPaddingMs: 80,
            silenceDurationMs: 220,
          },
        },
        systemInstruction: `You are a passive real-time speech-to-text listener. ${languageHint} Never converse or answer questions; stay silent and only let input audio transcription capture speech.`,
      },
      callbacks: {
        onopen: () => {
          sessionReady = true;
          while (pendingAudioChunks.length > 0) {
            const chunk = pendingAudioChunks.shift();
            if (chunk) sendPcmToSession(chunk);
          }
          sendJson(clientWs, {
            type: "ready",
            engine: config.geminiLiveModel,
          });
        },
        onmessage: (message: LiveServerMessage) => {
          if (closed) return;

          if (message.setupComplete) {
            sessionReady = true;
            while (pendingAudioChunks.length > 0) {
              const chunk = pendingAudioChunks.shift();
              if (chunk) sendPcmToSession(chunk);
            }
            sendJson(clientWs, {
              type: "ready",
              engine: config.geminiLiveModel,
            });
          }

          const inputTx = message.serverContent?.inputTranscription;
          if (inputTx?.text) {
            sendJson(clientWs, {
              type: "transcript",
              text: inputTx.text,
              isFinal: Boolean(inputTx.finished),
              language,
            });
          }

          if (message.serverContent?.turnComplete) {
            sendJson(clientWs, { type: "turn_complete" });
          }
        },
        onerror: (err: ErrorEvent) => {
          console.error("[ws:gemini] Live API error:", err.message);
          sendJson(clientWs, {
            type: "error",
            message: err.message || "Gemini Live API connection error",
          });
        },
        onclose: () => {
          if (!closed && clientWs.readyState === WebSocket.OPEN) {
            sendJson(clientWs, { type: "done" });
            clientWs.close();
          }
        },
      },
    });
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Failed to connect to Gemini Live";
    console.error("[ws:gemini] Connect failed:", msg);
    sendJson(clientWs, { type: "error", message: msg });
    clientWs.close();
  }
}

async function bridgeWhisperSocket(
  clientWs: WebSocket,
  language: string
): Promise<void> {
  if (!config.whisperWsUrl) {
    sendJson(clientWs, {
      type: "error",
      message:
        "WHISPER_WS_URL is not configured. Start the Docker Faster-Whisper service or switch to Gemini Live 3.1 / Browser Speech.",
    });
    clientWs.close();
    return;
  }

  const targetUrl = `${config.whisperWsUrl}?language=${encodeURIComponent(language)}`;
  const upstream = new WebSocket(targetUrl);

  upstream.on("open", () => {
    sendJson(clientWs, { type: "ready", engine: "faster-whisper" });
  });

  upstream.on("message", (data, isBinary) => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.send(isBinary ? rawDataToBuffer(data) : data.toString());
    }
  });

  upstream.on("error", (err) => {
    console.error("[ws:whisper] Upstream error:", err.message);
    sendJson(clientWs, {
      type: "error",
      message: `Faster-Whisper service unavailable: ${err.message}`,
    });
    clientWs.close();
  });

  upstream.on("close", () => {
    if (clientWs.readyState === WebSocket.OPEN) {
      clientWs.close();
    }
  });

  clientWs.on("message", (data, isBinary) => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.send(isBinary ? rawDataToBuffer(data) : data.toString());
    }
  });

  clientWs.on("close", () => {
    if (upstream.readyState === WebSocket.OPEN) {
      upstream.close();
    }
  });
}
