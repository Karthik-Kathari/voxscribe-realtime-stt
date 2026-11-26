import { AudioWaveform, Database, Plus, Sparkles } from "lucide-react";
import type { EngineStatus } from "../types";

interface HeaderProps {
  status: EngineStatus | null;
  onNewManual: () => void;
}

export function Header({ status, onNewManual }: HeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/85 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-3.5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-cyan-500 shadow-lg shadow-indigo-500/25">
            <AudioWaveform className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold tracking-tight text-white">
                VoxScribe AI
              </h1>
              <span className="rounded-full border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-[11px] font-medium text-indigo-300">
                Real-Time Multilingual STT
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Hindi + English (Hinglish) &amp; Multilingual Live Transcription with PostgreSQL History
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              status?.databaseConnected
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-300"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <Database className="h-3.5 w-3.5" />
            <span>
              {status?.databaseConnected ? "Neon Postgres" : "DB Checking..."}
            </span>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium ${
              status?.geminiConfigured
                ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
                : "border-slate-700 bg-slate-900 text-slate-400"
            }`}
            title={
              status?.geminiConfigured
                ? `Active model: ${status.geminiModel}`
                : "Set GEMINI_API_KEY in .env to enable Gemini Live 3.1"
            }
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>
              {status?.geminiConfigured
                ? "Gemini Live 3.1 Ready"
                : "Gemini Key Not Set"}
            </span>
          </div>

          <button
            type="button"
            onClick={onNewManual}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 ring-1 ring-slate-700 transition hover:bg-slate-700 hover:text-white"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Entry</span>
          </button>
        </div>
      </div>
    </header>
  );
}

