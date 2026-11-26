interface ShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: "Recording & Playback",
    items: [
      { keys: ["Space"], description: "Start or stop microphone recording" },
      { keys: ["P"], description: "Play or stop Read Aloud (TTS)" },
      { keys: ["Esc"], description: "Stop active TTS or close dialog" },
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
      { keys: ["Ctrl", "S"], description: "Save current note to PostgreSQL" },
      { keys: ["N"], description: "Create a new manual note" },
      { keys: ["/"], description: "Focus History Library search" },
      { keys: ["?"], description: "Open or close this shortcuts dialog" },
    ],
  },
];

export function ShortcutsModal({ open, onClose }: ShortcutsModalProps) {
  if (!open) return null;

  return (
    <div
      className="animate-backdrop-fade fixed inset-0 z-50 bg-scrim/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcutsTitle"
      onClick={onClose}
    >
      <div
        className="animate-modal-enter flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-surface-container border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-5 py-4 border-b border-outline-variant">
          <h2
            id="shortcutsTitle"
            className="font-headline text-lg font-semibold text-on-surface"
          >
            Keyboard Shortcuts
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close shortcuts dialog"
            className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              close
            </span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-1.5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-outline">
                {group.title}
              </h3>
              <div className="divide-y divide-outline-variant rounded-lg bg-surface-container-lowest border border-outline-variant">
                {group.items.map((item) => (
                  <div
                    key={item.description}
                    className="flex items-center justify-between gap-4 px-3.5 py-2.5"
                  >
                    <span className="text-sm text-on-surface-variant">
                      {item.description}
                    </span>
                    <div className="flex shrink-0 items-center gap-1">
                      {item.keys.map((key, idx) => (
                        <span key={key} className="inline-flex items-center gap-1">
                          {idx > 0 && (
                            <span className="text-xs text-outline">+</span>
                          )}
                          <kbd className="px-2 py-0.5 rounded bg-surface-container border border-outline-variant font-mono text-xs text-on-surface">
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

        <div className="shrink-0 border-t border-outline-variant bg-surface-container-low px-5 py-2.5 text-xs text-outline">
          Single-key shortcuts pause automatically while typing in text fields.
        </div>
      </div>
    </div>
  );
}
