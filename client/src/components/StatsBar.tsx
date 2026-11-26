import { formatDuration, type TranscriptionStats } from "../types";

interface StatsBarProps {
  stats: TranscriptionStats | null;
  onOpenHistory?: (starredOnly?: boolean) => void;
}

export function StatsBar({ stats, onOpenHistory }: StatsBarProps) {
  const items = [
    {
      label: "NOTES SAVED",
      value: stats ? String(stats.totalCount) : "—",
      accent: "text-on-surface",
      hint: "View all →",
      onClick: onOpenHistory ? () => onOpenHistory(false) : undefined,
    },
    {
      label: "WORDS CAPTURED",
      value: stats ? stats.totalWords.toLocaleString() : "—",
      accent: "text-on-surface",
      hint: null,
      onClick: undefined,
    },
    {
      label: "AUDIO RECORDED",
      value: stats ? formatDuration(stats.totalDurationSeconds) : "—",
      accent: "text-on-surface",
      hint: null,
      onClick: undefined,
    },
    {
      label: "STARRED",
      value: stats ? String(stats.favoriteCount) : "—",
      accent: "text-secondary",
      hint: "Filter →",
      onClick: onOpenHistory ? () => onOpenHistory(true) : undefined,
    },
  ];

  return (
    <section
      aria-label="Workspace summary"
      className="grid grid-cols-2 lg:grid-cols-4 gap-4"
    >
      {items.map((item, idx) => {
        const clickable = Boolean(item.onClick);
        return (
          <div
            key={item.label}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={item.onClick}
            onKeyDown={(e) => {
              if (clickable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                item.onClick?.();
              }
            }}
            style={{ animationDelay: `${idx * 65}ms` }}
            className={`animate-card-cascade card-hover rounded-xl bg-surface-container-low border border-outline-variant px-4 py-3 flex flex-col gap-1 ${
              clickable ? "cursor-pointer" : ""
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium tracking-wide text-outline">
                {item.label}
              </span>
              {item.hint && (
                <span className="text-[11px] font-medium text-secondary">
                  {item.hint}
                </span>
              )}
            </div>
            <span
              className={`font-headline text-[22px] leading-7 font-semibold tabular-nums ${item.accent}`}
            >
              {item.value}
            </span>
          </div>
        );
      })}
    </section>
  );
}
