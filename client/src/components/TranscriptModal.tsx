import { useEffect, useState } from "react";
import {
  LANGUAGE_OPTIONS,
  formatDuration,
  type Transcription,
} from "../types";
import { isTtsSupported, speakText, stopSpeaking } from "../lib/tts";
import { TtsSpeedControl } from "./TtsSpeedControl";

interface TranscriptModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: Transcription | null;
  ttsRate: number;
  onTtsRateChange: (rate: number) => void;
  onClose: () => void;
  onSave: (payload: {
    id?: string;
    title: string;
    content: string;
    language: string;
    notes: string;
    isFavorite: boolean;
  }) => Promise<void>;
}

export function TranscriptModal({
  open,
  mode,
  initial,
  ttsRate,
  onTtsRateChange,
  onClose,
  onSave,
}: TranscriptModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [language, setLanguage] = useState("hi-en");
  const [notes, setNotes] = useState("");
  const [isFavorite, setIsFavorite] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    if (mode === "edit" && initial) {
      setTitle(initial.title);
      setContent(initial.content);
      setLanguage(initial.language);
      setNotes(initial.notes || "");
      setIsFavorite(initial.isFavorite);
    } else {
      setTitle("");
      setContent("");
      setLanguage("hi-en");
      setNotes("");
      setIsFavorite(false);
    }
    return () => {
      stopSpeaking();
      setSpeaking(false);
    };
  }, [open, mode, initial]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) {
      setError("Transcription text cannot be empty.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        id: initial?.id,
        title: title.trim(),
        content: content.trim(),
        language,
        notes: notes.trim(),
        isFavorite,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes");
    } finally {
      setSaving(false);
    }
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const handleExportTxt = () => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(title || "transcription").replace(/[^a-z0-9-_]+/gi, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleSpeak = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    void speakText(content, language, {
      rate: ttsRate,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <div
      className="animate-backdrop-fade fixed inset-0 z-50 bg-scrim/70 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editModalTitle"
      onClick={onClose}
    >
      <div
        className="animate-modal-enter flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-surface-container border border-outline-variant"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between px-6 py-4 border-b border-outline-variant">
          <div>
            <h2
              id="editModalTitle"
              className="font-headline text-lg font-semibold text-on-surface"
            >
              {mode === "create" ? "New Note" : "Edit Transcription"}
            </h2>
            {initial && (
              <p className="mt-0.5 font-mono text-xs text-outline tabular-nums">
                {initial.engine} · {initial.wordCount} words ·{" "}
                {formatDuration(initial.durationSeconds)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              aria-label="Toggle star"
              className={`w-8 h-8 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center cursor-pointer ${isFavorite ? "text-warning" : "text-outline hover:text-warning"
                }`}
            >
              <span
                className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: `'FILL' ${isFavorite ? 1 : 0}` }}
              >
                star
              </span>
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close edit dialog"
              className="w-8 h-8 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright flex items-center justify-center cursor-pointer"
            >
              <span className="material-symbols-outlined text-base" aria-hidden="true">
                close
              </span>
            </button>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex-1 space-y-4 overflow-y-auto p-6"
        >
          {error && (
            <div className="rounded-lg bg-error-container border border-error px-3.5 py-2 text-xs text-on-error-container">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-on-surface-variant">
                Title
              </span>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-generated if left blank..."
                className="rounded-lg bg-surface-container-lowest border border-outline-variant px-3.5 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-medium text-on-surface-variant">
                Language Mode
              </span>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="rounded-lg bg-surface-container-lowest border border-outline-variant px-3.5 py-2 text-sm text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium text-on-surface-variant">
                Transcript
              </span>
              <div className="flex flex-wrap items-center gap-1.5">
                {isTtsSupported() && content.trim() && (
                  <>
                    <TtsSpeedControl
                      rate={ttsRate}
                      onChange={onTtsRateChange}
                      compact
                    />
                    <button
                      type="button"
                      onClick={toggleSpeak}
                      className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium cursor-pointer ${speaking
                          ? "bg-error-container border-error text-on-error-container"
                          : "bg-surface-container-lowest border-outline-variant text-secondary hover:text-on-surface"
                        }`}
                    >
                      <span className="material-symbols-outlined text-sm">
                        {speaking ? "stop_circle" : "volume_up"}
                      </span>
                      <span>{speaking ? "Stop" : "Listen"}</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => void handleCopy()}
                  className="inline-flex items-center gap-1 rounded-lg bg-surface-container-lowest border border-outline-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <span className="material-symbols-outlined text-sm">
                    {copied ? "check" : "content_copy"}
                  </span>
                  <span>{copied ? "Copied" : "Copy"}</span>
                </button>
                <button
                  type="button"
                  onClick={handleExportTxt}
                  className="inline-flex items-center gap-1 rounded-lg bg-surface-container-lowest border border-outline-variant px-2.5 py-1 text-xs font-medium text-on-surface-variant hover:text-on-surface cursor-pointer"
                >
                  <span>.TXT</span>
                </button>
              </div>
            </div>

            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter or edit multilingual transcript text..."
              className="rounded-lg bg-surface-container-lowest border border-outline-variant px-3.5 py-2.5 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none leading-relaxed"
              required
            />
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-on-surface-variant">
              Notes / Context
            </span>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional meeting notes or context..."
              className="rounded-lg bg-surface-container-lowest border border-outline-variant px-3.5 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
            />
          </label>

          {initial && initial.segments && initial.segments.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-outline">
                Captured Segments ({initial.segments.length})
              </p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-outline-variant bg-surface-container-lowest p-3">
                {initial.segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="flex items-start gap-2.5 text-xs text-on-surface-variant"
                  >
                    <span className="shrink-0 font-mono text-[11px] text-outline">
                      {seg.timestamp}
                    </span>
                    <span className="flex-1">{seg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2 border-t border-outline-variant">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-bright text-xs font-medium cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary text-xs font-medium disabled:opacity-50 cursor-pointer"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
