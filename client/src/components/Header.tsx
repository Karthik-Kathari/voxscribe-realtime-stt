import { Mic, Plus } from "lucide-react";
import type { EngineStatus } from "../types";

interface HeaderProps {
  status: EngineStatus | null;
  onNewManual: () => void;
}

export function Header({ status, onNewManual }: HeaderProps) {
  return (
    <header className="border-b border-[#e5e2da] bg-[#f5f4ef]">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-900 bg-zinc-900 text-[#f5f4ef]">
            <Mic className="h-4 w-4" />
          </div>
          <div>
            <div className="flex items-baseline gap-2.5">
              <h1 className="text-lg font-bold tracking-tight text-zinc-900">
                VoxScribe
              </h1>
              <span className="text-xs font-medium text-stone-500">
                Multilingual Voice Notes
              </span>
            </div>
            <p className="text-xs text-stone-500">
              Real-time Hindi, English &amp; Hinglish transcription stored in PostgreSQL
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="hidden items-center gap-4 text-xs text-stone-600 sm:flex">
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  status?.databaseConnected ? "bg-emerald-600" : "bg-amber-500"
                }`}
              />
              {status?.databaseConnected ? "Postgres connected" : "Checking DB"}
            </span>
            <span className="text-stone-300">|</span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  status?.geminiConfigured ? "bg-emerald-600" : "bg-stone-400"
                }`}
              />
              {status?.geminiConfigured ? "Gemini Live 3.1" : "Gemini key unset"}
            </span>
          </div>

          <button
            type="button"
            onClick={onNewManual}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8d4ca] bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-stone-400 hover:bg-stone-50"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>
    </header>
  );
}
