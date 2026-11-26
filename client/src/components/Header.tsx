import { Keyboard, Mic, Plus } from "lucide-react";
import type { EngineStatus } from "../types";

interface HeaderProps {
  status: EngineStatus | null;
  onNewManual: () => void;
  onOpenShortcuts: () => void;
}

export function Header({
  status,
  onNewManual,
  onOpenShortcuts,
}: HeaderProps) {
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
              Real-time Hindi, Kannada, Tamil, Telugu &amp; English transcription in PostgreSQL
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <div className="hidden items-center gap-4 pr-1 text-xs text-stone-600 md:flex">
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
              {status?.geminiConfigured ? "Gemini Audio Ready" : "Gemini key unset"}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#d8d4ca] bg-white px-2.5 py-1.5 text-xs font-medium text-stone-700 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:border-stone-400 hover:bg-stone-50 hover:text-zinc-900"
          >
            <Keyboard className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Shortcuts</span>
            <kbd className="rounded border border-[#e2dfd7] bg-[#faf9f5] px-1 py-0.2 font-mono text-[10px] text-stone-500">
              ?
            </kbd>
          </button>

          <button
            type="button"
            onClick={onNewManual}
            title="Create new manual note (N)"
            className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:bg-zinc-800"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Note</span>
          </button>
        </div>
      </div>
    </header>
  );
}
