/**
 * Client-side open-source/browser Web Speech Synthesis helper for reading saved
 * multilingual (Hindi / English / Hinglish) transcriptions aloud.
 */

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

export function stopSpeaking(): void {
  if (isTtsSupported()) {
    window.speechSynthesis.cancel();
  }
}

export function speakText(
  text: string,
  languageCode: string,
  options?: {
    rate?: number;
    onStart?: () => void;
    onEnd?: () => void;
    onError?: () => void;
  }
): void {
  if (!isTtsSupported()) {
    options?.onError?.();
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);

  // Choose an appropriate voice/lang tag based on script or selection
  const hasDevanagari = /[\u0900-\u097F]/.test(text);
  const resolvedLang = hasDevanagari
    ? "hi-IN"
    : languageCode === "hi-en" || languageCode === "multilingual"
      ? "en-IN"
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

