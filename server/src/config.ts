import "dotenv/config";

export const config = {
  port: Number(process.env.PORT) || 5000,
  nodeEnv: process.env.NODE_ENV || "development",
  databaseUrl: process.env.DATABASE_URL || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  geminiLiveModel:
    process.env.GEMINI_LIVE_MODEL || "gemini-3.1-flash-live-preview",
  whisperWsUrl: process.env.WHISPER_WS_URL || "",
};

