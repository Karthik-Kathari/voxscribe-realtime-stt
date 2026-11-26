export type SttEngine = "gemini-live-3.1" | "faster-whisper" | "web-speech";

export interface TranscriptSegment {
  id: string;
  text: string;
  language?: string;
  timestamp: string;
}

export interface Transcription {
  id: string;
  title: string;
  content: string;
  language: string;
  detectedLanguages: string[];
  engine: string;
  durationSeconds: number;
  wordCount: number;
  segments: TranscriptSegment[];
  notes: string;
  isFavorite: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptionListResponse {
  items: Transcription[];
  total: number;
  limit: number;
  offset: number;
}

export interface TranscriptionStats {
  totalCount: number;
  totalWords: number;
  totalDurationSeconds: number;
  favoriteCount: number;
  byLanguage: Array<{ language: string; count: number }>;
  byEngine: Array<{ engine: string; count: number }>;
}

export interface EngineStatus {
  geminiConfigured: boolean;
  geminiModel: string;
  whisperConfigured: boolean;
  databaseConnected: boolean;
}

export const LANGUAGE_OPTIONS = [
  { value: "hi-en", label: "Hinglish (Hindi + English)", speechLang: "en-IN" },
  { value: "multilingual", label: "Auto Multilingual", speechLang: "en-IN" },
  { value: "en-IN", label: "English (India)", speechLang: "en-IN" },
  { value: "en-US", label: "English (US)", speechLang: "en-US" },
  { value: "hi-IN", label: "Hindi (हिन्दी)", speechLang: "hi-IN" },
  { value: "ta-IN", label: "Tamil (தமிழ்)", speechLang: "ta-IN" },
  { value: "te-IN", label: "Telugu (తెలుగు)", speechLang: "te-IN" },
  { value: "kn-IN", label: "Kannada (ಕನ್ನಡ)", speechLang: "kn-IN" },
  { value: "bn-IN", label: "Bengali (বাংলা)", speechLang: "bn-IN" },
] as const;

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

