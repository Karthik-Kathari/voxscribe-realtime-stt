import { RotateCcw } from "lucide-react";

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
      className={`inline-flex items-center gap-2 rounded-lg bg-surface-container-lowest border border-outline-variant ${
        compact ? "px-2 py-1" : "px-3 py-1.5"
      }`}
    >
      <span className="text-xs font-medium text-outline">Speed</span>
      <input
        type="range"
        min="0.6"
        max="1.8"
        step="0.1"
        value={rate}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`cursor-pointer accent-primary-container ${
          compact ? "w-14" : "w-20"
        }`}
        title="Adjust Read Aloud TTS speed ([ slower, ] faster)"
        aria-label="TTS playback speed"
      />
      <span className="w-9 text-right font-mono text-xs font-medium text-on-surface tabular-nums">
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
            ? "cursor-default text-outline-variant"
            : "text-secondary hover:bg-surface-container-high hover:text-on-surface cursor-pointer"
        }`}
      >
        <RotateCcw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
