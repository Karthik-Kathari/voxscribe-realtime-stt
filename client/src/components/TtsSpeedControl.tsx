import { Gauge, RotateCcw } from "lucide-react";

interface TtsSpeedControlProps {
  rate: number;
  onChange: (rate: number) => void;
  compact?: boolean;
}

export function TtsSpeedControl({
  rate,
  onChange,
  compact = false,
}: TtsSpeedControlProps) {
  const isDefault = Math.abs(rate - 1.0) < 0.01;

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border border-[#e5e2da] bg-[#faf9f5] ${
        compact ? "px-2 py-0.5" : "px-2.5 py-1"
      }`}
    >
      <Gauge className="h-3.5 w-3.5 shrink-0 text-stone-500" />
      {!compact && (
        <span className="text-[11px] font-medium text-stone-600">Speed</span>
      )}
      <input
        type="range"
        min="0.6"
        max="1.8"
        step="0.1"
        value={rate}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`h-1.5 cursor-pointer accent-zinc-900 ${
          compact ? "w-14" : "w-20"
        }`}
        title="Adjust Read Aloud TTS speed ([ slower, ] faster)"
        aria-label="TTS playback speed"
      />
      <span className="w-8 text-right font-mono text-[11px] font-medium text-zinc-800">
        {rate.toFixed(1)}x
      </span>
      <button
        type="button"
        onClick={() => onChange(1.0)}
        disabled={isDefault}
        title="Reset speed to 1.0x (0)"
        aria-label="Reset TTS speed to 1.0x"
        className={`rounded p-0.5 transition ${
          isDefault
            ? "cursor-default text-stone-300"
            : "text-stone-600 hover:bg-stone-200/70 hover:text-zinc-900"
        }`}
      >
        <RotateCcw className="h-3 w-3" />
      </button>
    </div>
  );
}

