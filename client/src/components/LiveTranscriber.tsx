import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Cpu,
  Globe,
  Mic,
  RotateCcw,
  Save,
  Sparkles,
  Square,
  Volume2,
  VolumeX,
} from "lucide-react";
import { startPcmCapture, type AudioCaptureHandle } from "../lib/audio";
import { isTtsSupported, speakText, stopSpeaking } from "../lib/tts";
import {
  LANGUAGE_OPTIONS,
  formatDuration,
  type EngineStatus,
  type SttEngine,
  type TranscriptSegment,
} from "../types";

interface LiveTranscriberProps {
  engineStatus: EngineStatus | null;
  onSaveTranscription: (payload: {
    title?: string;
    content: string;
    language: string;
    engine: string;
    durationSeconds: number;
    segments: TranscriptSegment[];
  }) => Promise<void>;
}

interface SpeechRecognitionAlternativeLike {
  transcript: string;
}
interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

export function LiveTranscriber({
  engineStatus,
  onSaveTranscription,
}: LiveTranscriberProps) {
  const [engine, setEngine] = useState<SttEngine>("gemini-live-3.1");
  const [language, setLanguage] = useState<string>("hi-en");
  const [isRecording, setIsRecording] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [autoSave, setAutoSave] = useState(true);
  const [title, setTitle] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState("");
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array(28).fill(8));
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>(
    "Ready. Speak naturally in Hindi, English, or mixed Hinglish."
  );
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioCaptureHandle | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const interimRef = useRef("");
  const elapsedRef = useRef(0);
  const hasSavedCurrentRef = useRef(false);
  const [editedText, setEditedText] = useState<string | null>(null);

  // Sync default engine once health check resolves
  useEffect(() => {
    if (!engineStatus) return;
    if (engineStatus.geminiConfigured) {
      setEngine("gemini-live-3.1");
    } else if (engineStatus.whisperConfigured) {
      setEngine("faster-whisper");
    } else {
      setEngine("web-speech");
    }
  }, [engineStatus]);

  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  useEffect(() => {
    interimRef.current = interimText;
  }, [interimText]);

  useEffect(() => {
    elapsedRef.current = elapsedSeconds;
  }, [elapsedSeconds]);

  useEffect(() => {
    return () => {
      cleanupSession();
      stopSpeaking();
    };
  }, []);

  const combinedText = (
    editedText !== null
      ? editedText
      : [segments.map((s) => s.text).join(" "), interimText.trim()]
          .filter(Boolean)
          .join(" ")
  ).trim();

  const startTimer = () => {
    stopTimer();
    setElapsedSeconds(0);
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const pushWaveformLevel = (rms: number) => {
    const height = Math.min(100, Math.max(8, Math.round(rms * 420)));
    setWaveform((prev) => [...prev.slice(1), height]);
  };

  const appendFinalSegment = (text: string, detectedLang?: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const now = new Date();
    const stamp = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    setSegments((prev) => [
      ...prev,
      {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        text: cleaned,
        language: detectedLang,
        timestamp: stamp,
      },
    ]);
  };

  const cleanupSession = async () => {
    isRecordingRef.current = false;
    stopTimer();
    setWaveform(Array(28).fill(8));

    if (audioRef.current) {
      try {
        await audioRef.current.stop();
      } catch {
        // ignore audio teardown errors
      }
      audioRef.current = null;
    }

    if (wsRef.current) {
      try {
        if (wsRef.current.readyState === WebSocket.OPEN) {
          wsRef.current.send(JSON.stringify({ type: "stop" }));
        }
        wsRef.current.close();
      } catch {
        // ignore ws close errors
      }
      wsRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore speech recognition teardown errors
      }
      recognitionRef.current = null;
    }
  };

  const startWebSocketEngine = async (selectedEngine: "gemini-live-3.1" | "faster-whisper") => {
    setIsConnecting(true);
    setError(null);
    setStatusNote(`Connecting to ${selectedEngine === "gemini-live-3.1" ? "Gemini Live 3.1" : "Self-Hosted Faster-Whisper"}...`);

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const engineParam =
      selectedEngine === "gemini-live-3.1" ? "gemini" : "whisper";
    const wsUrl = `${protocol}//${window.location.host}/ws/transcribe?engine=${engineParam}&language=${encodeURIComponent(language)}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    ws.onopen = async () => {
      try {
        const audioHandle = await startPcmCapture((pcmBuffer, rms) => {
          pushWaveformLevel(rms);
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(pcmBuffer);
          }
        });
        audioRef.current = audioHandle;
        isRecordingRef.current = true;
        setIsConnecting(false);
        setIsRecording(true);
        startTimer();
        setStatusNote("Listening live... Speak naturally in Hindi, English, or Hinglish.");
      } catch (micErr) {
        setError(
          micErr instanceof Error
            ? `Microphone access failed: ${micErr.message}`
            : "Microphone permission denied."
        );
        setIsConnecting(false);
        setIsRecording(false);
        await cleanupSession();
      }
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data as string) as {
          type: string;
          text?: string;
          isFinal?: boolean;
          language?: string;
          message?: string;
          engine?: string;
        };

        if (msg.type === "ready") {
          setStatusNote(
            `Streaming audio to ${msg.engine || selectedEngine} in real time...`
          );
        } else if (msg.type === "transcript" && msg.text) {
          if (msg.isFinal) {
            appendFinalSegment(msg.text, msg.language);
            setInterimText("");
          } else {
            // Gemini Live emits progressive BPE transcript chunks on inputTranscription
            setInterimText((prev) => {
              const incoming = msg.text || "";
              if (!prev) return incoming;
              if (incoming.startsWith(prev)) return incoming;
              return prev + incoming;
            });
          }
        } else if (msg.type === "turn_complete") {
          // Commit accumulated interim text as a completed utterance segment
          if (interimRef.current.trim()) {
            appendFinalSegment(interimRef.current);
            setInterimText("");
          }
        } else if (msg.type === "error") {
          setError(msg.message || "Transcription stream error");
          void handleStop(false);
        }
      } catch {
        // ignore non-JSON frames
      }
    };

    ws.onerror = () => {
      setError("WebSocket connection error. Verify server & API key configuration.");
      setIsConnecting(false);
      void handleStop(false);
    };

    ws.onclose = () => {
      if (isRecordingRef.current) {
        setIsRecording(false);
        setIsConnecting(false);
        stopTimer();
      }
    };
  };

  const startBrowserSpeechEngine = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        "Browser Web Speech API is not supported in this browser. Use Chrome/Edge or select Gemini Live 3.1."
      );
      return;
    }

    const langConfig = LANGUAGE_OPTIONS.find((o) => o.value === language);
    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = langConfig?.speechLang || "en-IN";

    recognition.onresult = (event) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const transcript = result[0]?.transcript || "";
        if (result.isFinal) {
          appendFinalSegment(transcript, recognition.lang);
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
      pushWaveformLevel(0.15 + Math.random() * 0.15);
    };

    recognition.onerror = (event) => {
      if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(`Speech recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          // ignore restart race
        }
      }
    };

    recognitionRef.current = recognition;
    isRecordingRef.current = true;
    setError(null);
    setIsRecording(true);
    startTimer();
    setStatusNote("Listening via Browser Web Speech API (instant open fallback)...");
    recognition.start();
  };

  const handleStart = async () => {
    if (isRecording || isConnecting) return;
    setError(null);
    if (hasSavedCurrentRef.current) {
      setSegments([]);
      setInterimText("");
      setEditedText(null);
      setTitle("");
      setElapsedSeconds(0);
      hasSavedCurrentRef.current = false;
    } else if (editedText !== null) {
      setEditedText(null);
    }
    if (engine === "web-speech") {
      startBrowserSpeechEngine();
    } else {
      await startWebSocketEngine(engine);
    }
  };

  const handleStop = async (triggerAutoSave = true) => {
    const finalInterim = interimRef.current.trim();
    const currentDuration = elapsedRef.current;

    await cleanupSession();
    setIsRecording(false);
    setIsConnecting(false);

    let finalSegments = [...segmentsRef.current];
    if (finalInterim) {
      const seg: TranscriptSegment = {
        id: `${Date.now()}-final`,
        text: finalInterim,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      };
      finalSegments = [...finalSegments, seg];
      setSegments(finalSegments);
      setInterimText("");
    }

    const fullContent = finalSegments
      .map((s) => s.text)
      .join(" ")
      .trim();

    if (triggerAutoSave && autoSave && fullContent) {
      setStatusNote("Saving transcription to Neon PostgreSQL...");
      await persistCurrent(fullContent, finalSegments, currentDuration);
    } else {
      setStatusNote("Recording stopped. Edit or save your transcription below.");
    }
  };

  const persistCurrent = async (
    overrideContent?: string,
    overrideSegments?: TranscriptSegment[],
    overrideDuration?: number
  ) => {
    const contentToSave = (overrideContent ?? combinedText).trim();
    if (!contentToSave) return;

    setSaving(true);
    setError(null);
    try {
      await onSaveTranscription({
        title: title.trim() || undefined,
        content: contentToSave,
        language,
        engine,
        durationSeconds: overrideDuration ?? elapsedSeconds,
        segments: overrideSegments ?? segments,
      });
      hasSavedCurrentRef.current = true;
      setStatusNote("Saved to PostgreSQL transcription history!");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save transcription"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (isRecording) return;
    setSegments([]);
    setInterimText("");
    setEditedText(null);
    setTitle("");
    setElapsedSeconds(0);
    hasSavedCurrentRef.current = false;
    setError(null);
    setStatusNote("Cleared workspace. Ready for a new recording.");
  };

  const handleTtsPreview = () => {
    if (!combinedText) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    speakText(combinedText, language, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  const engineOptions: Array<{
    id: SttEngine;
    label: string;
    badge: string;
    available: boolean;
    icon: typeof Sparkles;
    hint: string;
  }> = [
    {
      id: "gemini-live-3.1",
      label: "Gemini Live 3.1",
      badge: "Free API · Real-Time",
      available: Boolean(engineStatus?.geminiConfigured),
      icon: Sparkles,
      hint: "Best for Hindi + English code-switching (Hinglish)",
    },
    {
      id: "faster-whisper",
      label: "Faster-Whisper",
      badge: "Self-Hosted OSS",
      available: Boolean(engineStatus?.whisperConfigured),
      icon: Cpu,
      hint: "Open-source Docker microservice (run via docker-compose)",
    },
    {
      id: "web-speech",
      label: "Browser Speech",
      badge: "Zero-Setup",
      available: true,
      icon: Globe,
      hint: "Built-in browser STT fallback (works with zero API keys)",
    },
  ];

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-b from-slate-900/90 to-slate-900/60 shadow-2xl">
      <div className="border-b border-slate-800/80 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Live Multilingual Studio
            </h2>
            <p className="text-xs text-slate-400">{statusNote}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={language}
              disabled={isRecording}
              onChange={(e) => setLanguage(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/70 px-3 py-1.5 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0"
              />
              <span>Auto-save on stop</span>
            </label>
          </div>
        </div>

        {/* Engine Switcher */}
        <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
          {engineOptions.map((opt) => {
            const Icon = opt.icon;
            const active = engine === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                disabled={isRecording}
                onClick={() => setEngine(opt.id)}
                className={`flex items-start gap-2.5 rounded-xl border p-3 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  active
                    ? "border-indigo-500/60 bg-indigo-500/10 ring-1 ring-indigo-500/30"
                    : "border-slate-800 bg-slate-950/60 hover:border-slate-700"
                }`}
              >
                <div
                  className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? "bg-indigo-500 text-white"
                      : "bg-slate-800 text-slate-400"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-1">
                    <span className="text-xs font-semibold text-white">
                      {opt.label}
                    </span>
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                        opt.available
                          ? "bg-emerald-500/15 text-emerald-300"
                          : "bg-slate-800 text-slate-400"
                      }`}
                    >
                      {opt.available ? opt.badge : "Not Configured"}
                    </span>
                  </div>
                  <p className="mt-0.5 line-clamp-1 text-[11px] text-slate-400">
                    {opt.hint}
                  </p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="space-y-4 p-5 sm:p-6">
        {error && (
          <div className="flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Controls + Waveform */}
        <div className="flex flex-col items-center justify-between gap-4 rounded-xl border border-slate-800/90 bg-slate-950/70 p-4 sm:flex-row">
          <div className="flex items-center gap-4">
            {!isRecording ? (
              <button
                type="button"
                disabled={isConnecting}
                onClick={handleStart}
                className="group relative flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 text-white shadow-lg shadow-indigo-500/30 transition hover:scale-105 hover:from-indigo-400 hover:to-violet-500 disabled:opacity-50"
                title="Start Real-Time Transcription"
              >
                <Mic className="h-6 w-6" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStop(true)}
                className="relative flex h-14 w-14 items-center justify-center rounded-full bg-rose-600 text-white shadow-lg shadow-rose-600/30 transition hover:scale-105 hover:bg-rose-500"
                title="Stop Recording"
              >
                <span className="absolute inset-0 animate-ping rounded-full bg-rose-500/35" />
                <Square className="relative h-5 w-5 fill-current" />
              </button>
            )}

            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-white">
                  {isConnecting
                    ? "Connecting..."
                    : isRecording
                      ? "Recording Live"
                      : "Press Mic to Speak"}
                </span>
                <span className="rounded-md bg-slate-800 px-2 py-0.5 font-mono text-xs text-slate-300">
                  {formatDuration(elapsedSeconds)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                Try saying:{" "}
                <span className="italic text-slate-300">
                  &ldquo;Hello team, aaj ka standup 5 minute mein start karte hain.&rdquo;
                </span>
              </p>
            </div>
          </div>

          {/* Live Audio Level Bars */}
          <div className="flex h-10 items-center gap-1">
            {waveform.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`w-1.5 rounded-full transition-all duration-100 ${
                  isRecording
                    ? "bg-gradient-to-t from-indigo-500 to-cyan-400"
                    : "bg-slate-800"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Live Transcript Output Box */}
        <div className="space-y-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Optional session title (e.g., Hinglish Product Standup)..."
            className="w-full rounded-xl border border-slate-800 bg-slate-950/70 px-3.5 py-2 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
          />

          <div className="min-h-[150px] rounded-xl border border-slate-800 bg-slate-950/80 p-4">
            {!isRecording && (segments.length > 0 || editedText !== null) ? (
              <textarea
                rows={5}
                value={editedText ?? combinedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="Edit your captured transcript..."
                className="w-full resize-y bg-transparent text-sm leading-relaxed text-slate-100 focus:outline-none"
              />
            ) : segments.length === 0 && !interimText ? (
              <div className="flex h-28 flex-col items-center justify-center text-center text-xs text-slate-500">
                <p>Your real-time multilingual transcription will appear here word by word.</p>
                <p className="mt-1 text-[11px] text-slate-600">
                  Supports Hindi + English code-switching, Devanagari, Latin, and regional Indian languages.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-sm leading-relaxed">
                <p className="whitespace-pre-wrap text-slate-100">
                  {segments.map((s) => s.text).join(" ")}
                  {interimText && (
                    <span className="ml-1 text-indigo-300/90 underline decoration-indigo-500/40 decoration-dotted underline-offset-4">
                      {interimText}
                    </span>
                  )}
                </p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-xs text-slate-400">
              {combinedText
                ? `${combinedText.split(/\s+/).filter(Boolean).length} words`
                : "0 words"}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isTtsSupported() && combinedText && (
                <button
                  type="button"
                  onClick={handleTtsPreview}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700"
                >
                  {speaking ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                      <span>Stop Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5 text-cyan-400" />
                      <span>Read Aloud (TTS)</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={isRecording || !combinedText}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:bg-slate-800 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                disabled={isRecording || saving || !combinedText}
                onClick={() => void persistCurrent()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? "Saving..." : "Save to History"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

