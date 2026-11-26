import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  Gauge,
  Mic,
  RotateCcw,
  Save,
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
  ttsRate: number;
  onTtsRateChange: (rate: number) => void;
  hotkeyDisabled?: boolean;
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
  ttsRate,
  onTtsRateChange,
  hotkeyDisabled = false,
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
  const [editedText, setEditedText] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array(28).fill(10));
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>(
    "Ready. Press Space or click Record to speak in Hindi, English, or Hinglish."
  );
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioCaptureHandle | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const timerRef = useRef<number | null>(null);
  const isRecordingRef = useRef(false);
  const isConnectingRef = useRef(false);
  const segmentsRef = useRef<TranscriptSegment[]>([]);
  const interimRef = useRef("");
  const elapsedRef = useRef(0);
  const hasSavedCurrentRef = useRef(false);

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
      void cleanupSession();
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
    const height = Math.min(100, Math.max(10, Math.round(rms * 460)));
    setWaveform((prev) => [...prev.slice(1), height]);
  };

  const appendFinalSegment = (text: string, detectedLang?: string) => {
    const cleaned = text.trim();
    if (!cleaned) return;
    const stamp = new Date().toLocaleTimeString([], {
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
    isConnectingRef.current = false;
    stopTimer();
    setWaveform(Array(28).fill(10));

    if (audioRef.current) {
      try {
        await audioRef.current.stop();
      } catch {
        // ignore teardown errors
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
        // ignore close errors
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

  const startWebSocketEngine = async (
    selectedEngine: "gemini-live-3.1" | "faster-whisper"
  ) => {
    isConnectingRef.current = true;
    setIsConnecting(true);
    setError(null);
    setStatusNote("Opening microphone and live stream...");

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const engineParam =
      selectedEngine === "gemini-live-3.1" ? "gemini" : "whisper";
    const wsUrl = `${protocol}//${window.location.host}/ws/transcribe?engine=${engineParam}&language=${encodeURIComponent(language)}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const earlyPcmQueue: ArrayBuffer[] = [];

    // Start mic capture immediately in parallel with WebSocket handshake
    const micPromise = startPcmCapture((pcmBuffer, rms) => {
      pushWaveformLevel(rms);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(pcmBuffer);
      } else if (ws.readyState === WebSocket.CONNECTING && earlyPcmQueue.length < 40) {
        earlyPcmQueue.push(pcmBuffer);
      }
    });

    ws.onopen = () => {
      while (earlyPcmQueue.length > 0) {
        const chunk = earlyPcmQueue.shift();
        if (chunk && ws.readyState === WebSocket.OPEN) {
          ws.send(chunk);
        }
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
            `Listening live (${msg.engine || selectedEngine}) — speak naturally.`
          );
        } else if (msg.type === "transcript" && msg.text) {
          if (msg.isFinal) {
            appendFinalSegment(msg.text, msg.language);
            setInterimText("");
          } else {
            setInterimText((prev) => {
              const incoming = msg.text || "";
              if (!prev) return incoming;
              if (incoming.startsWith(prev)) return incoming;
              return prev + incoming;
            });
          }
        } else if (msg.type === "turn_complete") {
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
      setError("WebSocket connection error. Verify server & API key.");
      isConnectingRef.current = false;
      setIsConnecting(false);
      void handleStop(false);
    };

    ws.onclose = () => {
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        isConnectingRef.current = false;
        setIsRecording(false);
        setIsConnecting(false);
        stopTimer();
      }
    };

    try {
      const audioHandle = await micPromise;
      audioRef.current = audioHandle;
      isRecordingRef.current = true;
      isConnectingRef.current = false;
      setIsConnecting(false);
      setIsRecording(true);
      startTimer();
      setStatusNote("Listening live... Press Space when finished.");
    } catch (micErr) {
      earlyPcmQueue.length = 0;
      setError(
        micErr instanceof Error
          ? `Microphone access failed: ${micErr.message}`
          : "Microphone permission denied."
      );
      isConnectingRef.current = false;
      setIsConnecting(false);
      setIsRecording(false);
      await cleanupSession();
    }
  };

  const startBrowserSpeechEngine = () => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        "Browser Web Speech API is unavailable here. Use Chrome/Edge or Gemini Live 3.1."
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
      pushWaveformLevel(0.18 + Math.random() * 0.22);
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
    setStatusNote("Listening via Browser Speech... Press Space when finished.");
    recognition.start();
  };

  const handleStart = async () => {
    if (isRecordingRef.current || isConnectingRef.current) return;
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
      setStatusNote("Saving note to PostgreSQL...");
      await persistCurrent(fullContent, finalSegments, currentDuration);
    } else {
      setStatusNote("Stopped. Review, edit, or save below.");
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
      setStatusNote("Saved to history. Press Space anytime to record a new note.");
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
    setStatusNote("Cleared. Press Space or click Record to start.");
  };

  const handleTtsPreview = () => {
    if (!combinedText) return;
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    void speakText(combinedText, language, {
      rate: ttsRate,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  // Keep latest handlers in refs for global Spacebar shortcut
  const handleStartRef = useRef(handleStart);
  const handleStopRef = useRef(handleStop);
  handleStartRef.current = handleStart;
  handleStopRef.current = handleStop;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hotkeyDisabled) return;
      if (e.code !== "Space" && e.key !== " ") return;
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      if (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        tag === "A" ||
        target?.isContentEditable
      ) {
        return;
      }

      e.preventDefault();
      if (isRecordingRef.current) {
        void handleStopRef.current(true);
      } else if (!isConnectingRef.current) {
        void handleStartRef.current();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hotkeyDisabled]);

  const engineTabs: Array<{
    id: SttEngine;
    label: string;
    available: boolean;
  }> = [
    {
      id: "gemini-live-3.1",
      label: "Gemini Live 3.1",
      available: Boolean(engineStatus?.geminiConfigured),
    },
    {
      id: "faster-whisper",
      label: "Faster-Whisper",
      available: Boolean(engineStatus?.whisperConfigured),
    },
    {
      id: "web-speech",
      label: "Browser Speech",
      available: true,
    },
  ];

  return (
    <section className="overflow-hidden rounded-xl border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece9e2] px-5 py-3.5 sm:px-6">
        <div>
          <h2 className="text-sm font-semibold text-zinc-900">
            Voice Recorder
          </h2>
          <p className="text-xs text-stone-500">{statusNote}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Segmented Engine Picker */}
          <div className="inline-flex rounded-lg border border-[#e5e2da] bg-[#f5f4ef] p-0.5">
            {engineTabs.map((tab) => {
              const active = engine === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  disabled={isRecording}
                  onClick={() => setEngine(tab.id)}
                  title={
                    tab.available
                      ? tab.label
                      : `${tab.label} is not configured in .env`
                  }
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed ${
                    active
                      ? "bg-white text-zinc-900 shadow-xs"
                      : "text-stone-600 hover:text-zinc-900"
                  } ${!tab.available && !active ? "opacity-55" : ""}`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <select
            value={language}
            disabled={isRecording}
            onChange={(e) => setLanguage(e.target.value)}
            className="rounded-lg border border-[#d8d4ca] bg-white px-2.5 py-1.5 text-xs font-medium text-zinc-800 focus:border-zinc-900 focus:outline-none disabled:opacity-60"
          >
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-stone-600 select-none">
            <input
              type="checkbox"
              checked={autoSave}
              onChange={(e) => setAutoSave(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-stone-300 accent-zinc-900"
            />
            <span>Auto-save</span>
          </label>
        </div>
      </div>

      {/* Studio Body */}
      <div className="space-y-4 p-5 sm:p-6">
        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs text-red-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-600" />
            <span>{error}</span>
          </div>
        )}

        {/* Record Bar */}
        <div className="flex flex-col justify-between gap-4 rounded-xl border border-[#e5e2da] bg-[#faf9f5] px-4 py-3.5 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3.5">
            {!isRecording ? (
              <button
                type="button"
                disabled={isConnecting}
                onClick={() => void handleStart()}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
                title="Start recording (Space)"
              >
                <Mic className="h-5 w-5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void handleStop(true)}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white shadow-sm transition hover:bg-zinc-800 active:scale-95"
                title="Stop recording (Space)"
              >
                <Square className="h-4 w-4 fill-current" />
              </button>
            )}

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-zinc-900">
                  {isConnecting
                    ? "Connecting..."
                    : isRecording
                      ? "Recording"
                      : "Start Recording"}
                </span>
                <span className="rounded border border-[#e2dfd7] bg-white px-2 py-0.5 font-mono text-xs text-zinc-700">
                  {formatDuration(elapsedSeconds)}
                </span>
                <kbd className="hidden items-center rounded border border-[#d8d4ca] bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-500 sm:inline-flex">
                  Space
                </kbd>
              </div>
              <p className="mt-0.5 text-xs text-stone-500">
                Try:{" "}
                <span className="italic text-stone-600">
                  &ldquo;Hello team, aaj ka standup 5 minute mein start karte hain.&rdquo;
                </span>
              </p>
            </div>
          </div>

          {/* Analog Level Meter */}
          <div className="flex h-9 items-center gap-1 self-end sm:self-center">
            {waveform.map((h, i) => (
              <span
                key={i}
                style={{ height: `${h}%` }}
                className={`w-1 rounded-full transition-all duration-75 ${
                  isRecording ? "bg-red-600" : "bg-[#d6d2c8]"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Title + Live / Editable Transcript */}
        <div className="space-y-2.5">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional — auto-generated from your first words)"
            className="w-full rounded-lg border border-[#e5e2da] bg-[#faf9f5] px-3.5 py-2 text-xs text-zinc-900 placeholder:text-stone-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
          />

          <div className="min-h-[140px] rounded-xl border border-[#e5e2da] bg-[#faf9f5] p-4">
            {!isRecording && (segments.length > 0 || editedText !== null) ? (
              <textarea
                rows={4}
                value={editedText ?? combinedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder="Edit your captured transcript..."
                className="w-full resize-y bg-transparent text-sm leading-relaxed text-zinc-900 focus:outline-none"
              />
            ) : segments.length === 0 && !interimText ? (
              <div className="flex h-24 flex-col items-center justify-center text-center text-xs text-stone-400">
                <p>Live words appear here as you speak.</p>
                <p className="mt-1 text-[11px] text-stone-400">
                  Press <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 text-[10px] text-stone-600">Space</kbd> anywhere outside text fields to toggle the mic.
                </p>
              </div>
            ) : (
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-zinc-900">
                {segments.map((s) => s.text).join(" ")}
                {interimText && (
                  <span className="ml-1 text-stone-500 underline decoration-stone-400 decoration-dotted underline-offset-4">
                    {interimText}
                  </span>
                )}
              </p>
            )}
          </div>

          {/* Footer Actions + TTS Speed Scroller */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="font-mono text-xs text-stone-500">
              {combinedText
                ? `${combinedText.split(/\s+/).filter(Boolean).length} words`
                : "0 words"}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {isTtsSupported() && (
                <div className="flex items-center gap-2 rounded-lg border border-[#e5e2da] bg-[#faf9f5] px-2.5 py-1">
                  <Gauge className="h-3.5 w-3.5 text-stone-500" />
                  <span className="text-[11px] font-medium text-stone-600">
                    Speed
                  </span>
                  <input
                    type="range"
                    min="0.6"
                    max="1.8"
                    step="0.1"
                    value={ttsRate}
                    onChange={(e) => onTtsRateChange(Number(e.target.value))}
                    className="h-1.5 w-20 cursor-pointer accent-zinc-900"
                    title="Adjust Read Aloud TTS playback speed"
                  />
                  <span className="w-8 text-right font-mono text-[11px] font-medium text-zinc-800">
                    {ttsRate.toFixed(1)}x
                  </span>
                </div>
              )}

              {isTtsSupported() && combinedText && (
                <button
                  type="button"
                  onClick={handleTtsPreview}
                  className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                    speaking
                      ? "border-red-300 bg-red-50 text-red-700"
                      : "border-[#d8d4ca] bg-white text-zinc-800 hover:bg-stone-50"
                  }`}
                >
                  {speaking ? (
                    <>
                      <VolumeX className="h-3.5 w-3.5" />
                      <span>Stop Audio</span>
                    </>
                  ) : (
                    <>
                      <Volume2 className="h-3.5 w-3.5" />
                      <span>Read Aloud</span>
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                disabled={isRecording || !combinedText}
                onClick={handleReset}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8d4ca] bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Clear</span>
              </button>

              <button
                type="button"
                disabled={isRecording || saving || !combinedText}
                onClick={() => void persistCurrent()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                <span>{saving ? "Saving..." : "Save Note"}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
