/**
 * Multilingual Text-to-Speech helper with real-time playback rate control.
 * Primary: Server neural TTS (/api/tts using hi-IN-SwaraNeural / en-IN-NeerjaNeural).
 * Fallback: Browser Web Speech Synthesis if offline/unavailable.
 */

let activeAudio: HTMLAudioElement | null = null;
let activeObjectUrl: string | null = null;
let activeController: AbortController | null = null;

const TTS_RATE_STORAGE_KEY = "voxscribe_tts_rate";

export function getSavedTtsRate(): number {
  try {
    const raw = localStorage.getItem(TTS_RATE_STORAGE_KEY);
    if (!raw) return 1.0;
    const parsed = Number(raw);
    return Number.isFinite(parsed) && parsed >= 0.5 && parsed <= 2.0
      ? parsed
      : 1.0;
  } catch {
    return 1.0;
  }
}

export function saveTtsRate(rate: number): void {
  try {
    localStorage.setItem(TTS_RATE_STORAGE_KEY, String(rate));
  } catch {
    // ignore storage failures
  }
}

export function setLivePlaybackRate(rate: number): void {
  if (activeAudio) {
    activeAudio.playbackRate = rate;
  }
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined";
}

export function stopSpeaking(): void {
  if (activeController) {
    activeController.abort();
    activeController = null;
  }
  if (activeAudio) {
    activeAudio.pause();
    activeAudio.currentTime = 0;
    activeAudio = null;
  }
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl);
    activeObjectUrl = null;
  }
  if (typeof window !== "undefined" && "speechSynthesis" in window) {
    window.speechSynthesis.cancel();
  }
}

function fallbackBrowserSpeech(
  text: string,
  languageCode: string,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    options?.onError?.();
    return;
  }

  window.speechSynthesis.cancel();
  const normalizedText = text.replace(/\baaj\b/gi, "aajh");
  const utterance = new SpeechSynthesisUtterance(normalizedText);
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const resolvedLang = hasDevanagari
    ? "hi-IN"
    : languageCode === "hi-en" || languageCode === "multilingual"
      ? "hi-IN"
      : languageCode;

  utterance.lang = resolvedLang;
  utterance.rate = options?.rate ?? 1.0;

  const voices = window.speechSynthesis.getVoices();
  const matchingVoice =
    voices.find((v) => v.lang.toLowerCase() === resolvedLang.toLowerCase()) ||
    voices.find((v) =>
      v.lang.toLowerCase().startsWith(resolvedLang.split("-")[0].toLowerCase())
    );
  if (matchingVoice) {
    utterance.voice = matchingVoice;
  }

  if (options?.onStart) utterance.onstart = options.onStart;
  if (options?.onEnd) utterance.onend = options.onEnd;
  if (options?.onError) utterance.onerror = () => options.onError?.();

  window.speechSynthesis.speak(utterance);
}

export async function speakText(
  text: string,
  languageCode: string,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): Promise<void> {
  const trimmed = text.trim();
  if (!trimmed) {
    options?.onEnd?.();
    return;
  }

  stopSpeaking();
  const controller = new AbortController();
  activeController = controller;

  try {
    options?.onStart?.();
    const res = await fetch("/api/tts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: trimmed, language: languageCode }),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`TTS HTTP ${res.status}`);
    }

    const blob = await res.blob();
    if (controller.signal.aborted) return;

    const url = URL.createObjectURL(blob);
    activeObjectUrl = url;
    const audio = new Audio(url);
    audio.playbackRate = options?.rate ?? 1.0;
    activeAudio = audio;

    audio.onended = () => {
      if (activeObjectUrl === url) {
        URL.revokeObjectURL(url);
        activeObjectUrl = null;
      }
      if (activeAudio === audio) activeAudio = null;
      options?.onEnd?.();
    };
    audio.onerror = () => {
      if (activeObjectUrl === url) {
        URL.revokeObjectURL(url);
        activeObjectUrl = null;
      }
      if (activeAudio === audio) activeAudio = null;
      options?.onError?.();
    };

    await audio.play();
  } catch (err) {
    if (controller.signal.aborted) return;
    console.warn("[tts] Falling back to browser speech synthesis:", err);
    fallbackBrowserSpeech(trimmed, languageCode, options);
  }
}
