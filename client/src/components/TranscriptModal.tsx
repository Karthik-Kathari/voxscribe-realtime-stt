import { useEffect, useState } from "react";
import {
  Check,
  Copy,
  Download,
  Save,
  Star,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  formatDuration,
  type Transcription,
} from "../types";
import { isTtsSupported, speakText, stopSpeaking } from "../lib/tts";

interface TranscriptModalProps {
  open: boolean;
  mode: "create" | "edit";
  initial?: Transcription | null;
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
    speakText(content, language, {
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onError: () => setSpeaking(false),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
          <div>
            <h2 className="text-base font-semibold text-white">
              {mode === "create" ? "Create Transcription Entry" : "Edit Transcription"}
            </h2>
            {initial && (
              <p className="mt-0.5 text-xs text-slate-400">
                Engine: {initial.engine} &middot; {initial.wordCount} words &middot;{" "}
                {formatDuration(initial.durationSeconds)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              className={`rounded-lg p-2 transition ${
                isFavorite
                  ? "bg-amber-500/15 text-amber-400"
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              }`}
              title="Toggle favorite"
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-400" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-800 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-300">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-generated if left blank..."
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium text-slate-300">
                Language Mode
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white focus:border-indigo-500 focus:outline-none"
              >
                {LANGUAGE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <label className="text-xs font-medium text-slate-300">
                Transcript Text
              </label>
              <div className="flex items-center gap-1.5">
                {isTtsSupported() && content.trim() && (
                  <button
                    type="button"
                    onClick={toggleSpeak}
                    className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                  >
                    {speaking ? (
                      <>
                        <VolumeX className="h-3 w-3 text-rose-400" />
                        <span>Stop TTS</span>
                      </>
                    ) : (
                      <>
                        <Volume2 className="h-3 w-3 text-cyan-400" />
                        <span>Read Aloud</span>
                      </>
                    )}
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-400" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3 w-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={handleExportTxt}
                  className="inline-flex items-center gap-1 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-medium text-slate-200 hover:bg-slate-700"
                >
                  <Download className="h-3 w-3" />
                  <span>.TXT</span>
                </button>
              </div>
            </div>
            <textarea
              rows={7}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter or edit multilingual transcript text (Hindi, English, Hinglish...)"
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm leading-relaxed text-slate-100 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-300">
              Notes / Tags
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional meeting notes, context, or speaker details..."
              className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-200 placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {initial && initial.segments && initial.segments.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-slate-400">
                Captured Segments ({initial.segments.length})
              </p>
              <div className="max-h-36 space-y-1.5 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                {initial.segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="flex items-start gap-2.5 text-xs text-slate-300"
                  >
                    <span className="shrink-0 font-mono text-[11px] text-slate-500">
                      {seg.timestamp}
                    </span>
                    <span className="flex-1">{seg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 border-t border-slate-800 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-700 px-4 py-2 text-xs font-medium text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-indigo-500 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : "Save to PostgreSQL"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

