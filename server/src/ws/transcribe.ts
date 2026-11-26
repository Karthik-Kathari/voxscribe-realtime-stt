import {
  EndSensitivity,
  GoogleGenAI,
  Modality,
  StartSensitivity,
  type LiveServerMessage,
} from "@google/genai";
import WebSocket, { type RawData } from "ws";
import { config } from "../config.js";

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

/**
 * Handles a browser WebSocket connection for real-time speech-to-text.
 * Supports:
 *  - engine=gemini  -> Gemini Live 3.1 API (gemini-3.1-flash-live-preview)
 *  - engine=whisper -> Self-hosted open-source Faster-Whisper microservice
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

  await bridgeGeminiLiveSocket(clientWs, language);
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

  // Attach client listeners immediately so no initial spoken frames are lost during handshake
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
