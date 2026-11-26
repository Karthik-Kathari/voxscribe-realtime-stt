import { Clock, FileText, Languages, Star } from "lucide-react";
import { formatDuration, type TranscriptionStats } from "../types";

interface StatsBarProps {
  stats: TranscriptionStats | null;
}

export function StatsBar({ stats }: StatsBarProps) {
  const cards = [
    {
      label: "Saved Transcriptions",
      value: stats ? String(stats.totalCount) : "—",
      icon: FileText,
      accent: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    },
    {
      label: "Total Words Captured",
      value: stats ? stats.totalWords.toLocaleString() : "—",
      icon: Languages,
      accent: "text-cyan-400 bg-cyan-500/10 border-cyan-500/20",
    },
    {
      label: "Audio Duration",
      value: stats ? formatDuration(stats.totalDurationSeconds) : "—",
      icon: Clock,
      accent: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    },
    {
      label: "Starred Entries",
      value: stats ? String(stats.favoriteCount) : "—",
      icon: Star,
      accent: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="flex items-center gap-3 rounded-xl border border-slate-800/80 bg-slate-900/60 px-4 py-3"
          >
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${card.accent}`}
            >
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs text-slate-400">{card.label}</p>
              <p className="text-lg font-semibold text-white">{card.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}

