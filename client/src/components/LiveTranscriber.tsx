import { useEffect, useRef, useState } from "react";
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
  onToast: (msg: string) => void;
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
  onToast,
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
  const [waveform, setWaveform] = useState<number[]>(() => Array(28).fill(12));
  const [error, setError] = useState<string | null>(null);
  const [statusNote, setStatusNote] = useState<string>(
    "Ready. Press Space or click Start Recording to speak in any supported language."
  );
  const [saving, setSaving] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [copied, setCopied] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioRef = useRef<AudioCaptureHandle | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const demoTimerRef = useRef<number | null>(null);
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

  const stopDemoStream = () => {
    if (demoTimerRef.current !== null) {
      clearInterval(demoTimerRef.current);
      demoTimerRef.current = null;
    }
  };

  const pushWaveformLevel = (rms: number) => {
    const height = Math.min(100, Math.max(12, Math.round(rms * 460)));
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
    stopDemoStream();
    setWaveform(Array(28).fill(12));

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

    let aborted = false;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const engineParam =
      selectedEngine === "gemini-live-3.1" ? "gemini" : "whisper";
    const wsUrl = `${protocol}//${window.location.host}/ws/transcribe?engine=${engineParam}&language=${encodeURIComponent(language)}`;

    const ws = new WebSocket(wsUrl);
    ws.binaryType = "arraybuffer";
    wsRef.current = ws;

    const earlyPcmQueue: ArrayBuffer[] = [];

    const micPromise = startPcmCapture((pcmBuffer, rms) => {
      if (aborted) return;
      pushWaveformLevel(rms);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(pcmBuffer);
      } else if (ws.readyState === WebSocket.CONNECTING && earlyPcmQueue.length < 40) {
        earlyPcmQueue.push(pcmBuffer);
      }
    });

    ws.onopen = () => {
      if (aborted) return;
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
          aborted = true;
          earlyPcmQueue.length = 0;
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
      aborted = true;
      earlyPcmQueue.length = 0;
      setError("WebSocket connection error. Verify server & engine configuration.");
      isConnectingRef.current = false;
      setIsConnecting(false);
      doneResolverRef.current?.();
      doneResolverRef.current = null;
      void handleStop(false);
    };

    ws.onclose = () => {
      doneResolverRef.current?.();
      doneResolverRef.current = null;
      if (isConnectingRef.current) {
        aborted = true;
        isConnectingRef.current = false;
        setIsConnecting(false);
      }
      if (isRecordingRef.current) {
        isRecordingRef.current = false;
        setIsRecording(false);
        stopTimer();
      }
    };

    try {
      const audioHandle = await micPromise;
      if (
        aborted ||
        ws.readyState === WebSocket.CLOSING ||
        ws.readyState === WebSocket.CLOSED
      ) {
        await audioHandle.stop();
        isRecordingRef.current = false;
        isConnectingRef.current = false;
        setIsRecording(false);
        setIsConnecting(false);
        stopTimer();
        return;
      }

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
      aborted = true;
      earlyPcmQueue.length = 0;
      setError(
        micErr instanceof Error
          ? `Microphone access unavailable (${micErr.message}). Use "Demo Speech" or allow microphone permission.`
          : 'Microphone permission denied. Use "Demo Speech" or allow mic access.'
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
        "Browser Web Speech API is unavailable here. Use Chrome/Edge or Gemini AI."
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
      if (event.error === "no-speech" || event.error === "aborted") {
        return;
      }
      const fatalErrors = [
        "not-allowed",
        "service-not-allowed",
        "audio-capture",
        "network",
      ];
      if (fatalErrors.includes(event.error)) {
        const hint =
          event.error === "not-allowed"
            ? "Microphone permission denied. Allow mic access in your browser."
            : event.error === "network"
              ? "Browser Speech service requires internet access (or switch to Gemini AI)."
              : `Browser Speech error: ${event.error}`;
        setError(hint);
        void handleStop(false);
      } else {
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
    try {
      recognition.start();
    } catch (err) {
      setError(
        err instanceof Error
          ? `Failed to start Browser Speech: ${err.message}`
          : "Failed to start Browser Speech."
      );
      void handleStop(false);
    }
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

    // Pre-flight engine check before requesting microphone permission
    if (engine === "faster-whisper" && engineStatus && !engineStatus.whisperConfigured) {
      setError(
        "WHISPER_WS_URL is not configured. Run 'docker compose up --build' locally for Faster-Whisper, or switch to Gemini AI / Browser Speech."
      );
      return;
    }
    if (engine === "gemini-live-3.1" && engineStatus && !engineStatus.geminiConfigured) {
      setError(
        "GEMINI_API_KEY is not configured on the server. Add it to .env or switch to Browser Speech."
      );
      return;
    }

    setError(null);

    let initialElapsed = elapsedRef.current;

    if (mode === "new") {
      resetSessionState();
      initialElapsed = 0;
    } else if (editedTextRef.current !== null) {
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

  const handleDemoSpeech = () => {
    if (isRecordingRef.current || isConnectingRef.current) return;
    resetSessionState();
    setError(null);
    isRecordingRef.current = true;
    setIsRecording(true);
    startTimer(0);
    setStatusNote(`Simulating live ${activeLanguageConfig.label} speech...`);

    const words = activeLanguageConfig.sample.split(" ");
    let idx = 0;
    stopDemoStream();
    demoTimerRef.current = window.setInterval(() => {
      if (!isRecordingRef.current || idx >= words.length) {
        stopDemoStream();
        if (isRecordingRef.current) {
          void handleStop(true);
        }
        return;
      }
      const nextWord = words[idx++];
      const nextInterim = (
        interimRef.current ? `${interimRef.current} ${nextWord}` : nextWord
      ).trim();
      interimRef.current = nextInterim;
      setInterimText(nextInterim);
      pushWaveformLevel(0.16 + Math.random() * 0.24);
    }, 190);
  };

  const handleStop = async (triggerAutoSave = true) => {
    const currentDuration = elapsedRef.current;

    isRecordingRef.current = false;
    isConnectingRef.current = false;
    setIsRecording(false);
    setIsConnecting(false);
    stopTimer();
    stopDemoStream();
    setWaveform(Array(28).fill(12));

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
    setStatusNote("Started a fresh session. Press Space or click Start Recording.");
  };

  const handleClearText = () => {
    if (isRecording) return;
    segmentsRef.current = [];
    interimRef.current = "";
    editedTextRef.current = null;
    setSegments([]);
    setInterimText("");
    setEditedText(null);
    onToast("Transcript cleared");
  };

  const handleCopy = async () => {
    if (!combinedText) {
      onToast("Nothing to copy yet");
      return;
    }
    await navigator.clipboard.writeText(combinedText);
    setCopied(true);
    onToast("Transcription copied to clipboard");
    window.setTimeout(() => setCopied(false), 1600);
  };

  const handleTtsPreview = () => {
    if (!combinedText) {
      onToast("Record or type text to listen");
      return;
    }
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

  const activeEngineLabel =
    engineTabs.find((t) => t.id === engine)?.label ?? "Gemini AI";
  const hasSavedActiveNote = Boolean(activeRecordId && combinedText);

  return (
    <div className="flex flex-col gap-5">
      {/* Error / Permission Banner */}
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-error-container border border-error px-4 py-3 flex items-center justify-between gap-4"
        >
          <div className="flex items-center gap-3">
            <span
              className="material-symbols-outlined text-lg text-on-error-container"
              aria-hidden="true"
            >
              mic_off
            </span>
            <p className="text-sm text-on-error-container">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="px-3 py-1 rounded-lg bg-surface-container-lowest text-on-surface text-xs font-medium cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Primary Transcription Studio Workspace */}
      <section className="rounded-2xl bg-surface-container-low border border-outline-variant p-5 lg:p-6 flex flex-col gap-5">
        {/* Studio Top Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-outline-variant">
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="font-headline text-lg font-semibold text-on-surface">
                Voice Recorder Studio
              </h1>
              <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-xs font-medium text-secondary whitespace-nowrap">
                Free &amp; Open Source
              </span>
              {activeRecordId && (
                <span className="px-2 py-0.5 rounded-full bg-surface-container border border-outline-variant text-xs font-medium text-success whitespace-nowrap">
                  Synced to DB
                </span>
              )}
            </div>
            <p className="text-sm text-on-surface-variant">{statusNote}</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Engine Segmented Switcher */}
            <div
              role="tablist"
              aria-label="Speech Recognition Engine"
              className="inline-flex flex-wrap items-center p-1 rounded-lg bg-surface-container-lowest border border-outline-variant gap-1"
            >
              {engineTabs.map((tab) => {
                const active = engine === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    disabled={isRecording}
                    onClick={() => {
                      setEngine(tab.id);
                      setError(null);
                    }}
                    title={
                      tab.available
                        ? tab.label
                        : `${tab.label} is not configured in .env`
                    }
                    className={`px-3 py-1.5 rounded-sm text-xs font-medium whitespace-nowrap transition duration-150 cursor-pointer disabled:cursor-not-allowed ${active
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
                      } ${!tab.available && !active ? "opacity-55" : ""}`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {/* Language Dropdown */}
            <select
              value={language}
              disabled={isRecording}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Transcription language"
              className="rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none disabled:opacity-60"
            >
              {LANGUAGE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Auto-save Toggle */}
            <label className="inline-flex items-center gap-2 cursor-pointer select-none px-2.5 py-1.5 rounded-lg bg-surface-container-lowest border border-outline-variant">
              <input
                type="checkbox"
                checked={autoSave}
                onChange={(e) => setAutoSave(e.target.checked)}
                className="rounded border-outline-variant bg-surface-container accent-primary-container"
              />
              <span className="text-xs font-medium text-on-surface">
                Auto-save
              </span>
            </label>
          </div>
        </div>

        {/* Recording Control Bar & Live Waveform */}
        <div className="rounded-xl bg-surface-container-lowest border border-outline-variant p-4 lg:p-5 flex flex-col gap-4">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
            <div className="flex flex-wrap items-center gap-4">
              {!isRecording ? (
                <button
                  type="button"
                  disabled={isConnecting}
                  onClick={() => void handleRecordTrigger()}
                  aria-label="Start recording"
                  title="Start or resume recording (Space)"
                  className="w-14 h-14 rounded-full bg-recording text-on-recording flex items-center justify-center hover:opacity-90 active:scale-95 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:opacity-50 cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-2xl"
                    aria-hidden="true"
                  >
                    mic
                  </span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleStop(true)}
                  aria-label="Stop recording"
                  title="Stop recording (Space)"
                  className="animate-rec-ring w-14 h-14 rounded-full bg-recording text-on-recording flex items-center justify-center hover:opacity-90 active:scale-95 transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-2xl"
                    aria-hidden="true"
                  >
                    stop
                  </span>
                </button>
              )}

              <div className="flex flex-col gap-1">
                <div className="flex flex-wrap items-center gap-2.5">
                  <span className="font-headline text-base font-semibold text-on-surface">
                    {isConnecting
                      ? "Connecting..."
                      : isRecording
                        ? "Recording Live..."
                        : hasSavedActiveNote
                          ? "Resume or New Session"
                          : "Start Recording"}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant font-mono text-xs text-on-surface tabular-nums">
                    {formatDuration(elapsedSeconds)}
                  </span>
                  <kbd className="hidden sm:inline-block px-2 py-0.5 rounded bg-surface-container border border-outline-variant font-mono text-xs text-outline">
                    Space
                  </kbd>
                </div>
                <p className="text-xs text-outline">
                  Try:{" "}
                  <span className="italic text-on-surface-variant">
                    &ldquo;{activeLanguageConfig.sample}&rdquo;
                  </span>
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Next Mic Mode */}
              <div
                className="inline-flex items-center gap-1 p-1 rounded-lg bg-surface-container border border-outline-variant"
                title="Choose what happens when you press Mic after stopping a saved note"
              >
                <span className="text-xs font-medium text-outline px-2">
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
                    className={`px-2.5 py-1 rounded-sm text-xs font-medium transition cursor-pointer ${nextBehavior === opt.id
                        ? "bg-primary-container text-on-primary-container"
                        : "text-on-surface-variant hover:text-on-surface"
                      }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Live Waveform Visualizer */}
              <div className="w-48 sm:w-52 h-10 rounded-lg bg-surface-container border border-outline-variant px-3 flex items-center justify-between gap-0.5 overflow-hidden">
                {waveform.map((h, i) => (
                  <span
                    key={i}
                    style={{ height: `${h}%` }}
                    className={`w-1 rounded-full transition-all duration-75 ${isRecording
                        ? i % 2 === 0
                          ? "bg-primary"
                          : "bg-secondary"
                        : "bg-outline-variant"
                      }`}
                  />
                ))}
              </div>

              {/* Demo Speech Simulator */}
              <button
                type="button"
                disabled={isRecording || isConnecting}
                onClick={handleDemoSpeech}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-container-high border border-outline-variant text-secondary hover:bg-surface-bright text-xs font-medium transition duration-150 disabled:opacity-40 cursor-pointer"
                title="Simulate live speech input without a microphone"
              >
                <span
                  className="material-symbols-outlined text-base"
                  aria-hidden="true"
                >
                  play_arrow
                </span>
                <span>Demo Speech</span>
              </button>
            </div>
          </div>

          {/* Inline Continue vs Start New Session Prompt */}
          {showContinuePrompt && !isRecording && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-primary bg-surface-container px-4 py-3">
              <p className="text-xs font-medium text-on-surface">
                This note is already saved. Do you want to{" "}
                <strong className="text-secondary">continue adding</strong> to
                it or <strong className="text-primary">start a new session</strong>?
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => void beginRecording("continue")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-primary-container px-3 py-1.5 text-xs font-medium text-on-primary-container hover:bg-inverse-primary transition cursor-pointer"
                >
                  <span>Continue Note</span>
                  <kbd className="rounded bg-surface-container-lowest/40 px-1 font-mono text-[10px]">
                    C
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => void beginRecording("new")}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-surface-container-high border border-outline-variant px-3 py-1.5 text-xs font-medium text-on-surface hover:bg-surface-bright transition cursor-pointer"
                >
                  <span>New Session</span>
                  <kbd className="rounded bg-surface-container-lowest px-1 font-mono text-[10px] text-outline">
                    N
                  </kbd>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowContinuePrompt(false);
                    showPromptRef.current = false;
                  }}
                  className="px-2 py-1 text-xs text-outline hover:text-on-surface cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Note Title & Live Transcription Canvas */}
        <div className="flex flex-col gap-3">
          <label htmlFor="noteTitleInput" className="sr-only">
            Note title
          </label>
          <input
            id="noteTitleInput"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Note title (optional — auto-generated from your first words)"
            className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant px-4 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />

          <div className="rounded-xl bg-surface-container-lowest border border-outline-variant p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-outline-variant pb-2.5">
              <span className="inline-flex items-center gap-1.5 font-mono text-xs text-secondary">
                <span
                  className={`w-1.5 h-1.5 rounded-full ${isRecording ? "bg-recording" : "bg-secondary"
                    }`}
                  aria-hidden="true"
                />
                <span>
                  {activeEngineLabel} · {activeLanguageConfig.label}
                </span>
              </span>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant hover:text-on-surface text-xs font-medium transition cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    aria-hidden="true"
                  >
                    {copied ? "check" : "content_copy"}
                  </span>
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  disabled={isRecording || !combinedText}
                  onClick={handleClearText}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-container border border-outline-variant text-on-surface-variant hover:text-error text-xs font-medium transition disabled:opacity-40 cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-sm"
                    aria-hidden="true"
                  >
                    delete_sweep
                  </span>
                  <span>Clear</span>
                </button>
              </div>
            </div>

            {!isRecording && (segments.length > 0 || editedText !== null) ? (
              <textarea
                rows={7}
                value={editedText ?? combinedText}
                onChange={(e) => setEditedText(e.target.value)}
                placeholder={`Live words in ${activeLanguageConfig.label} appear here as you speak...`}
                className="w-full bg-transparent border-0 p-0 text-base text-on-surface placeholder:text-outline focus:ring-0 focus:outline-none resize-y leading-relaxed"
              />
            ) : (
              <div className="min-h-[168px] flex flex-col justify-between">
                {segments.length === 0 && !interimText ? (
                  <p className="text-base text-outline leading-relaxed">
                    Live words in {activeLanguageConfig.label} appear here as you
                    speak. Press <kbd className="px-1.5 py-0.5 rounded bg-surface-container border border-outline-variant font-mono text-xs text-on-surface-variant">Space</kbd> to
                    toggle the mic or click <strong className="text-secondary font-medium">Demo Speech</strong> to preview...
                  </p>
                ) : (
                  <p className="whitespace-pre-wrap text-base text-on-surface leading-relaxed">
                    {segments.map((s) => s.text).join(" ")}
                    {interimText && (
                      <span className="ml-1 text-secondary underline decoration-secondary/40 decoration-dotted underline-offset-4">
                        {interimText}
                      </span>
                    )}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Integrated Neural TTS Bar & Save Actions */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pt-2 border-t border-outline-variant">
          <div className="flex flex-wrap items-center gap-3">
            <span className="font-mono text-xs text-outline tabular-nums">
              {combinedText
                ? `${combinedText.split(/\s+/).filter(Boolean).length} words`
                : "0 words"}
            </span>

            {isTtsSupported() && (
              <div className="inline-flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleTtsPreview}
                  title="Play or stop Read Aloud (P)"
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${speaking
                      ? "bg-error-container border-error text-on-error-container"
                      : "bg-surface-container-lowest border-outline-variant text-secondary hover:text-on-surface hover:bg-surface-container"
                    }`}
                >
                  <span
                    className="material-symbols-outlined text-base"
                    aria-hidden="true"
                  >
                    {speaking ? "stop_circle" : "play_circle"}
                  </span>
                  <span>{speaking ? "Stop TTS" : "Listen (TTS)"}</span>
                </button>
                <TtsSpeedControl rate={ttsRate} onChange={onTtsRateChange} />
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {!isRecording && combinedText && (
              <button
                type="button"
                onClick={() => void beginRecording("continue")}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-bright text-xs font-medium transition cursor-pointer"
                title="Append more speech to this note"
              >
                <span
                  className="material-symbols-outlined text-base text-recording"
                  aria-hidden="true"
                >
                  mic
                </span>
                <span>Continue</span>
              </button>
            )}

            <button
              type="button"
              disabled={isRecording}
              onClick={handleNewSession}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-bright text-xs font-medium transition disabled:opacity-40 cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-base"
                aria-hidden="true"
              >
                refresh
              </span>
              <span>New Session</span>
            </button>

            <button
              type="button"
              disabled={isRecording || saving || !combinedText}
              onClick={() => void persistCurrent()}
              title="Save or update note in PostgreSQL (Ctrl+S)"
              className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary text-xs font-medium transition disabled:opacity-40 cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-base"
                aria-hidden="true"
              >
                save
              </span>
              <span>
                {saving
                  ? "Saving..."
                  : activeRecordId
                    ? "Update Note"
                    : "Save Transcription"}
              </span>
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
