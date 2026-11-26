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
  {
    value: "hi-en",
    label: "Hinglish (Hindi + English)",
    speechLang: "en-IN",
    sample: "Hello team, aaj ka standup 5 minute mein start karte hain.",
  },
  {
    value: "multilingual",
    label: "Auto Multilingual",
    speechLang: "en-IN",
    sample: "Good morning, आज हम project deployment review करेंगे.",
  },
  {
    value: "en-IN",
    label: "English (India)",
    speechLang: "en-IN",
    sample: "Please deploy the PostgreSQL update before our afternoon sync.",
  },
  {
    value: "en-US",
    label: "English (US)",
    speechLang: "en-US",
    sample: "Let's review the real-time transcription dashboard metrics.",
  },
  {
    value: "hi-IN",
    label: "Hindi (हिन्दी)",
    speechLang: "hi-IN",
    sample: "नमस्ते टीम, आज की मीटिंग पांच मिनट में शुरू होगी।",
  },
  {
    value: "kn-IN",
    label: "Kannada (ಕನ್ನಡ)",
    speechLang: "kn-IN",
    sample: "ನಮಸ್ಕಾರ, ಇವತ್ತು ಬೆಂಗಳೂರಿನಲ್ಲಿ ಹವಾಮಾನ ತುಂಬಾ ಚೆನ್ನಾಗಿದೆ.",
  },
  {
    value: "ta-IN",
    label: "Tamil (தமிழ்)",
    speechLang: "ta-IN",
    sample: "வணக்கம், இன்றைய மீட்டிங் ஐந்து நிமிடத்தில் தொடங்கும்.",
  },
  {
    value: "te-IN",
    label: "Telugu (తెలుగు)",
    speechLang: "te-IN",
    sample: "నమస్కారం, ఈరోజు మీటింగ్ ఐదు నిమిషాల్లో ప్రారంభమవుతుంది.",
  },
  {
    value: "ml-IN",
    label: "Malayalam (മലയാളം)",
    speechLang: "ml-IN",
    sample: "നമസ്കാരം, ഇന്നത്തെ മീറ്റിംഗ് അഞ്ച് മിനിറ്റിൽ തുടങ്ങും.",
  },
  {
    value: "mr-IN",
    label: "Marathi (मराठी)",
    speechLang: "mr-IN",
    sample: "नमस्कार, आजची मीटिंग पाच मिनिटांत सुरू होईल.",
  },
  {
    value: "gu-IN",
    label: "Gujarati (ગુજરાતી)",
    speechLang: "gu-IN",
    sample: "નમસ્તે, આજની મીટિંગ પાંચ મિનિટમાં શરૂ થશે.",
  },
  {
    value: "bn-IN",
    label: "Bengali (বাংলা)",
    speechLang: "bn-IN",
    sample: "নমস্কার, আজকের মিটিং পাঁচ মিনিটে শুরু হবে।",
  },
] as const;

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}
