import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  FilePlus2,
  Mic,
  Play,
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
  type Transcription,
} from "../types";
import { TtsSpeedControl } from "./TtsSpeedControl";

type NextRecordBehavior = "ask" | "continue" | "new";
const NEXT_RECORD_STORAGE_KEY = "voxscribe_next_record_behavior";

function getSavedNextRecordBehavior(): NextRecordBehavior {
  try {
    const val = localStorage.getItem(NEXT_RECORD_STORAGE_KEY);
    if (val === "ask" || val === "continue" || val === "new") return val;
  } catch {
    // ignore storage errors
  }
  return "ask";
}

interface LiveTranscriberProps {
  engineStatus: EngineStatus | null;
  ttsRate: number;
  onTtsRateChange: (rate: number) => void;
  hotkeyDisabled?: boolean;
  onSaveTranscription: (payload: {
    id?: string;
    title?: string;
    content: string;
    language: string;
    engine: string;
    durationSeconds: number;
    segments: TranscriptSegment[];
  }) => Promise<Transcription>;
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
  const [nextBehavior, setNextBehavior] = useState<NextRecordBehavior>(() =>
    getSavedNextRecordBehavior()
  );
  const [showContinuePrompt, setShowContinuePrompt] = useState(false);
  const [activeRecordId, setActiveRecordId] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [segments, setSegments] = useState<TranscriptSegment[]>([]);
  const [interimText, setInterimText] = useState("");
  const [editedText, setEditedText] = useState<string | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [waveform, setWaveform] = useState<number[]>(() => Array(28).fill(10));
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>(
    "Ready. Press Space or click Record to speak in any supported language."
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
  const activeRecordIdRef = useRef<string | null>(null);
  const editedTextRef = useRef<string | null>(null);
  const showPromptRef = useRef(false);
  const nextBehaviorRef = useRef<NextRecordBehavior>(nextBehavior);
  const doneResolverRef = useRef<(() => void) | null>(null);

  const activeLanguageConfig =
    LANGUAGE_OPTIONS.find((opt) => opt.value === language) ??
    LANGUAGE_OPTIONS[0];

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
    activeRecordIdRef.current = activeRecordId;
  }, [activeRecordId]);

  useEffect(() => {
    editedTextRef.current = editedText;
  }, [editedText]);

  useEffect(() => {
    showPromptRef.current = showContinuePrompt;
  }, [showContinuePrompt]);

  useEffect(() => {
    nextBehaviorRef.current = nextBehavior;
  }, [nextBehavior]);

  useEffect(() => {
    return () => {
      void forceCloseTransport();
      stopSpeaking();
    };
  }, []);

  const updateNextBehavior = (mode: NextRecordBehavior) => {
    setNextBehavior(mode);
    nextBehaviorRef.current = mode;
    try {
      localStorage.setItem(NEXT_RECORD_STORAGE_KEY, mode);
    } catch {
      // ignore storage errors
    }
  };

  const combinedText = (
    editedText !== null
      ? editedText
      : [segments.map((s) => s.text).join(" "), interimText.trim()]
          .filter(Boolean)
          .join(" ")
  ).trim();

  const startTimer = (initialSeconds = 0) => {
    stopTimer();
    elapsedRef.current = initialSeconds;
    setElapsedSeconds(initialSeconds);
    timerRef.current = window.setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        elapsedRef.current = next;
        return next;
      });
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
    const nextSeg: TranscriptSegment = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      text: cleaned,
      language: detectedLang,
      timestamp: stamp,
    };
    segmentsRef.current = [...segmentsRef.current, nextSeg];
    setSegments(segmentsRef.current);
  };

  const forceCloseTransport = async () => {
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
        // ignore teardown errors
      }
      recognitionRef.current = null;
    }
  };

  const startWebSocketEngine = async (
    selectedEngine: "gemini-live-3.1" | "faster-whisper",
    initialElapsed: number
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
            interimRef.current = "";
            setInterimText("");
          } else {
            setInterimText((prev) => {
              const incoming = msg.text || "";
              const next = !prev
                ? incoming
                : incoming.startsWith(prev)
                  ? incoming
                  : prev + incoming;
              interimRef.current = next;
              return next;
            });
          }
        } else if (msg.type === "turn_complete") {
          if (interimRef.current.trim()) {
            appendFinalSegment(interimRef.current);
            interimRef.current = "";
            setInterimText("");
          }
        } else if (msg.type === "done") {
          doneResolverRef.current?.();
          doneResolverRef.current = null;
        } else if (msg.type === "error") {
          setError(msg.message || "Transcription stream error");
          doneResolverRef.current?.();
          doneResolverRef.current = null;
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
      doneResolverRef.current?.();
      doneResolverRef.current = null;
      void handleStop(false);
    };

    ws.onclose = () => {
      doneResolverRef.current?.();
      doneResolverRef.current = null;
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
      startTimer(initialElapsed);
      setStatusNote(
        activeRecordIdRef.current
          ? "Continuing current note... Press Space when finished."
          : "Listening live... Press Space when finished."
      );
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
      await forceCloseTransport();
    }
  };

  const startBrowserSpeechEngine = (initialElapsed: number) => {
    const win = window as unknown as {
      SpeechRecognition?: new () => SpeechRecognitionLike;
      webkitSpeechRecognition?: new () => SpeechRecognitionLike;
    };
    const SpeechRec = win.SpeechRecognition || win.webkitSpeechRecognition;

    if (!SpeechRec) {
      setError(
        "Browser Web Speech API is unavailable here. Use Chrome/Edge or Gemini."
      );
      return;
    }

    const recognition = new SpeechRec();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = activeLanguageConfig.speechLang;

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
      interimRef.current = interim;
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
    startTimer(initialElapsed);
    setStatusNote(
      `Listening via Browser Speech (${activeLanguageConfig.speechLang})...`
    );
    recognition.start();
  };

  const resetSessionState = () => {
    segmentsRef.current = [];
    interimRef.current = "";
    editedTextRef.current = null;
    activeRecordIdRef.current = null;
    elapsedRef.current = 0;
    setSegments([]);
    setInterimText("");
    setEditedText(null);
    setActiveRecordId(null);
    setTitle("");
    setElapsedSeconds(0);
    setError(null);
  };

  const beginRecording = async (mode: "continue" | "new") => {
    if (isRecordingRef.current || isConnectingRef.current) return;
    setShowContinuePrompt(false);
    showPromptRef.current = false;
    setError(null);

    let initialElapsed = elapsedRef.current;

    if (mode === "new") {
      resetSessionState();
      initialElapsed = 0;
    } else if (editedTextRef.current !== null) {
      // Preserve any manual edits made before continuing
      const edited = editedTextRef.current.trim();
      const carriedSegments: TranscriptSegment[] = edited
        ? [
            {
              id: `${Date.now()}-edited`,
              text: edited,
              timestamp: new Date().toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }),
            },
          ]
        : [];
      segmentsRef.current = carriedSegments;
      setSegments(carriedSegments);
      editedTextRef.current = null;
      setEditedText(null);
    }

    if (engine === "web-speech") {
      startBrowserSpeechEngine(initialElapsed);
    } else {
      await startWebSocketEngine(engine, initialElapsed);
    }
  };

  const handleRecordTrigger = async () => {
    if (isRecordingRef.current || isConnectingRef.current) return;

    const hasExistingContent =
      segmentsRef.current.length > 0 ||
      Boolean(interimRef.current.trim()) ||
      Boolean(editedTextRef.current?.trim());

    // If there's an already-saved note in the studio, follow the user's preference
    if (hasExistingContent && activeRecordIdRef.current) {
      if (nextBehaviorRef.current === "ask") {
        setShowContinuePrompt(true);
        showPromptRef.current = true;
        return;
      }
      await beginRecording(nextBehaviorRef.current);
      return;
    }

    await beginRecording("continue");
  };

  const handleStop = async (triggerAutoSave = true) => {
    const currentDuration = elapsedRef.current;

    isRecordingRef.current = false;
    isConnectingRef.current = false;
    setIsRecording(false);
    setIsConnecting(false);
    stopTimer();
    setWaveform(Array(28).fill(10));

    if (audioRef.current) {
      try {
        await audioRef.current.stop();
      } catch {
        // ignore audio stop errors
      }
      audioRef.current = null;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.onend = null;
        recognitionRef.current.stop();
      } catch {
        // ignore recognition stop errors
      }
      recognitionRef.current = null;
    }

    const ws = wsRef.current;
    if (ws) {
      if (ws.readyState === WebSocket.OPEN) {
        setStatusNote("Finalizing transcript...");
        await new Promise<void>((resolve) => {
          const timeoutId = window.setTimeout(() => {
            doneResolverRef.current = null;
            resolve();
          }, 2600);
          doneResolverRef.current = () => {
            window.clearTimeout(timeoutId);
            resolve();
          };
          try {
            ws.send(JSON.stringify({ type: "stop" }));
          } catch {
            window.clearTimeout(timeoutId);
            resolve();
          }
        });
      }
      try {
        ws.close();
      } catch {
        // ignore close errors
      }
      wsRef.current = null;
    }

    const finalInterim = interimRef.current.trim();
    if (finalInterim) {
      appendFinalSegment(finalInterim);
      interimRef.current = "";
      setInterimText("");
    }

    const fullContent = segmentsRef.current
      .map((s) => s.text)
      .join(" ")
      .trim();

    if (triggerAutoSave && autoSave && fullContent) {
      setStatusNote(
        activeRecordIdRef.current
          ? "Updating note in PostgreSQL..."
          : "Saving note to PostgreSQL..."
      );
      await persistCurrent(fullContent, segmentsRef.current, currentDuration);
    } else {
      setStatusNote("Stopped. Continue speaking, edit, or save below.");
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
      const saved = await onSaveTranscription({
        id: activeRecordIdRef.current ?? undefined,
        title: title.trim() || undefined,
        content: contentToSave,
        language,
        engine,
        durationSeconds: overrideDuration ?? elapsedRef.current,
        segments: overrideSegments ?? segmentsRef.current,
      });
      activeRecordIdRef.current = saved.id;
      setActiveRecordId(saved.id);
      setStatusNote(
        "Saved to PostgreSQL. Click Continue to append or New Session for a fresh note."
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to save transcription"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleNewSession = () => {
    if (isRecording) return;
    setShowContinuePrompt(false);
    showPromptRef.current = false;
    resetSessionState();
    setStatusNote("New session ready. Press Space or click Record to start.");
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

  const handleTriggerRef = useRef(handleRecordTrigger);
  const handleBeginRef = useRef(beginRecording);
  const handleStopRef = useRef(handleStop);
  const handleTtsRef = useRef(handleTtsPreview);
  const handleSaveRef = useRef(persistCurrent);
  handleTriggerRef.current = handleRecordTrigger;
  handleBeginRef.current = beginRecording;
  handleStopRef.current = handleStop;
  handleTtsRef.current = handleTtsPreview;
  handleSaveRef.current = persistCurrent;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (hotkeyDisabled) return;

      // Handle quick choices inside the inline Continue vs New Session prompt
      if (showPromptRef.current) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowContinuePrompt(false);
          showPromptRef.current = false;
          return;
        }
        if (e.key.toLowerCase() === "c" || e.key === "Enter") {
          e.preventDefault();
          void handleBeginRef.current("continue");
          return;
        }
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          void handleBeginRef.current("new");
          return;
        }
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        if (!isRecordingRef.current) {
          void handleSaveRef.current();
        }
        return;
      }

      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isInteractive =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        tag === "BUTTON" ||
        tag === "A" ||
        Boolean(target?.isContentEditable);

      if (isInteractive) return;

      if (e.code === "Space" || e.key === " ") {
        e.preventDefault();
        if (isRecordingRef.current) {
          void handleStopRef.current(true);
        } else if (!isConnectingRef.current) {
          void handleTriggerRef.current();
        }
      } else if (e.key.toLowerCase() === "p") {
        e.preventDefault();
        handleTtsRef.current();
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
      label: "Gemini AI",
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

  const hasSavedActiveNote = Boolean(activeRecordId && combinedText);

  return (
    <section className="overflow-hidden rounded-xl border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      {/* Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#ece9e2] px-5 py-3.5 sm:px-6">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-900">
              Voice Recorder
            </h2>
            {activeRecordId && (
              <span className="rounded border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700">
                Synced to DB
              </span>
            )}
          </div>
          <p className="text-xs text-stone-500">{statusNote}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
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
            aria-label="Transcription language"
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
        <div className="space-y-3 rounded-xl border border-[#e5e2da] bg-[#faf9f5] px-4 py-3.5">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5">
              {!isRecording ? (
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => void handleRecordTrigger()}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-red-600 text-white shadow-sm transition hover:bg-red-700 active:scale-95 disabled:opacity-50"
                  title="Start or resume recording (Space)"
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
                        : hasSavedActiveNote
                          ? "Resume or New Session"
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
                    &ldquo;{activeLanguageConfig.sample}&rdquo;
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
              {/* Next mic press behavior selector */}
              <div
                className="inline-flex items-center gap-1 rounded-lg border border-[#e2dfd7] bg-white px-2 py-1"
                title="Choose what happens when you press Mic after stopping a saved note"
              >
                <span className="text-[10px] font-medium text-stone-500">
                  Next mic:
                </span>
                {(
                  [
                    { id: "ask", label: "Ask" },
                    { id: "continue", label: "Continue" },
                    { id: "new", label: "New" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    disabled={isRecording}
                    onClick={() => updateNextBehavior(opt.id)}
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium transition ${
                      nextBehavior === opt.id
                        ? "bg-zinc-900 text-white"
                        : "text-stone-600 hover:bg-stone-100"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="flex h-9 items-center gap-1">
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
          </div>

          {/* Inline Continue vs Start New Session Prompt */}
          {showContinuePrompt && !isRecording && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-300/80 bg-amber-50/70 px-3.5 py-2.5">
              <p className="text-xs font-medium text-zinc-800">
                This note is already saved. Do you want to{" "}
                <strong>continue adding</strong> to it or{" "}
                <strong>start a new session</strong>?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void beginRecording("continue")}
                  className="inline-flex items-center gap-1.5 rounded-md bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800"
                >
                  <Play className="h-3 w-3 fill-current" />
                  <span>Continue Note</span>
                  <kbd className="rounded bg-zinc-700 px-1 text-[10px] text-zinc-200">
                    C
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => void beginRecording("new")}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#d8d4ca] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 transition hover:bg-stone-50"
                >
                  <FilePlus2 className="h-3.5 w-3.5" />
                  <span>New Session</span>
                  <kbd className="rounded border border-stone-200 bg-stone-50 px-1 text-[10px] text-stone-500">
                    N
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowContinuePrompt(false);
                    showPromptRef.current = false;
                  }}
                  className="px-2 py-1 text-xs text-stone-500 hover:text-zinc-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
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
                <p>
                  Live words in{" "}
                  <strong className="font-medium text-stone-600">
                    {activeLanguageConfig.label}
                  </strong>{" "}
                  appear here as you speak.
                </p>
                <p className="mt-1 text-[11px] text-stone-400">
                  Press{" "}
                  <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 text-[10px] text-stone-600">
                    Space
                  </kbd>{" "}
                  to toggle the mic or{" "}
                  <kbd className="rounded border border-stone-300 bg-white px-1 py-0.5 text-[10px] text-stone-600">
                    ?
                  </kbd>{" "}
                  for all shortcuts.
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

          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <span className="font-mono text-xs text-stone-500">
              {combinedText
                ? `${combinedText.split(/\s+/).filter(Boolean).length} words`
                : "0 words"}
            </span>

            <div className="flex flex-wrap items-center gap-2">
              {isTtsSupported() && (
                <TtsSpeedControl rate={ttsRate} onChange={onTtsRateChange} />
              )}

              {isTtsSupported() && combinedText && (
                <button
                  type="button"
                  onClick={handleTtsPreview}
                  title="Play or stop Read Aloud (P)"
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

              {!isRecording && combinedText && (
                <button
                  type="button"
                  onClick={() => void beginRecording("continue")}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8d4ca] bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 transition hover:bg-stone-50"
                  title="Append more speech to this note"
                >
                  <Mic className="h-3.5 w-3.5 text-red-600" />
                  <span>Continue</span>
                </button>
              )}

              <button
                type="button"
                disabled={isRecording || !combinedText}
                onClick={handleNewSession}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8d4ca] bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-50 disabled:opacity-40"
                title="Clear and start a fresh recording session"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>New Session</span>
              </button>

              <button
                type="button"
                disabled={isRecording || saving || !combinedText}
                onClick={() => void persistCurrent()}
                title="Save or update note in PostgreSQL (Ctrl+S)"
                className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-40"
              >
                <Save className="h-3.5 w-3.5" />
                <span>
                  {saving
                    ? "Saving..."
                    : activeRecordId
                      ? "Update Note"
                      : "Save Note"}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
