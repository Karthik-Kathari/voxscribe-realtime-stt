import { formatDuration, type TranscriptionStats } from "../types";

interface StatsBarProps {
  stats: TranscriptionStats | null;
}

export function StatsBar({ stats }: StatsBarProps) {
  const items = [
    {
      label: "NOTES SAVED",
      value: stats ? String(stats.totalCount) : "—",
      accent: "text-on-surface",
    },
    {
      label: "WORDS CAPTURED",
      value: stats ? stats.totalWords.toLocaleString() : "—",
      accent: "text-on-surface",
    },
    {
      label: "AUDIO RECORDED",
      value: stats ? formatDuration(stats.totalDurationSeconds) : "—",
      accent: "text-on-surface",
    },
    {
      label: "STARRED",
      value: stats ? String(stats.favoriteCount) : "—",
      accent: "text-secondary",
    },
  ];

  return (
    <section
      aria-label="Workspace summary"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {items.map((item) => (
        <div
          key={item.label}
          className="card-hover rounded-xl bg-surface-container-low border border-outline-variant px-4 py-3 flex flex-col gap-1"
        >
          <span className="text-xs font-medium tracking-wide text-outline">
            {item.label}
          </span>
          <span
            className={`font-headline text-[22px] leading-7 font-semibold tabular-nums ${item.accent}`}
          >
            {item.value}
          </span>
        </div>
      ))}
    </section>
  );
}
