import { Keyboard, X } from "lucide-react";

interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Recording & Playback",
    items: [
      { keys: ["Space"], description: "Start or stop microphone recording" },
      { keys: ["P"], description: "Play or stop Read Aloud (TTS) for active note" },
      { keys: ["Esc"], description: "Stop active audio playback or close dialog" },
    ],
  },
  {
    title: "TTS Speed Control",
    items: [
      { keys: ["["], description: "Decrease Read Aloud speed by 0.1x" },
      { keys: ["]"], description: "Increase Read Aloud speed by 0.1x" },
      { keys: ["0"], description: "Reset Read Aloud speed to 1.0x" },
    ],
  },
  {
    title: "Notes & Navigation",
    items: [
      { keys: ["Ctrl", "S"], description: "Save current transcript to PostgreSQL" },
      { keys: ["N"], description: "Create a new manual note" },
      { keys: ["/"], description: "Focus saved transcriptions search" },
      { keys: ["?"], description: "Open or close this shortcuts guide" },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl border border-[#e5e2da] bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[#ece9e2] px-5 py-3.5">
          <div className="flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-zinc-800" />
            <h2 className="text-sm font-semibold text-zinc-900">
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-stone-400 transition hover:bg-stone-100 hover:text-zinc-900"
            aria-label="Close shortcuts"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-stone-500">
                {group.title}
              </h3>
              <div className="divide-y divide-[#f0ede6] rounded-lg border border-[#e5e2da] bg-[#faf9f5]">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between gap-4 px-3.5 py-2.5"
                  >
                    <span className="text-xs text-zinc-700">
                      {item.description}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key, idx) => (
                        <span key={key} className="inline-flex items-center gap-1">
                          {idx > 0 && (
                            <span className="text-[10px] text-stone-400">+</span>
                          )}
                          <kbd className="rounded border border-[#d8d4ca] bg-white px-1.5 py-0.5 font-mono text-[11px] font-medium text-zinc-800 shadow-[0_1px_0_rgba(0,0,0,0.05)]">
                            {key}
                          </kbd>
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[#ece9e2] bg-[#faf9f5] px-5 py-2.5 text-[11px] text-stone-500">
          Single-key shortcuts pause automatically while you are typing inside text fields.
        </div>
      </div>
    </div>
  );
}

