import { formatDuration, type TranscriptionStats } from "../types";

interface StatsBarProps {
  stats: TranscriptionStats | null;
}

export function StatsBar({ stats }: StatsBarProps) {
  const items = [
    {
      label: "Notes saved",
      value: stats ? String(stats.totalCount) : "—",
    },
    {
      label: "Words captured",
      value: stats ? stats.totalWords.toLocaleString() : "—",
    },
    {
      label: "Audio recorded",
      value: stats ? formatDuration(stats.totalDurationSeconds) : "—",
    },
    {
      label: "Starred",
      value: stats ? String(stats.favoriteCount) : "—",
    },
  ];

  return (
    <section className="grid grid-cols-2 divide-y divide-[#e5e2da] overflow-hidden rounded-xl border border-[#e5e2da] bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
      {items.map((item) => (
        <div key={item.label} className="px-4 py-3 sm:px-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-stone-500">
            {item.label}
          </p>
          <p className="mt-0.5 font-mono text-lg font-medium text-zinc-900">
            {item.value}
          </p>
        </div>
      ))}
    </section>
  );
}
