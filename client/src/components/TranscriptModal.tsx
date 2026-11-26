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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/45 p-4 backdrop-blur-xs">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-[#e5e2da] bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-[#ece9e2] px-6 py-4">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              {mode === "create" ? "New Voice Note" : "Edit Transcription"}
            </h2>
            {initial && (
              <p className="mt-0.5 font-mono text-[11px] text-stone-500">
                {initial.engine} &middot; {initial.wordCount} words &middot;{" "}
                {formatDuration(initial.durationSeconds)}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setIsFavorite((v) => !v)}
              className={`rounded-md p-1.5 transition ${
                isFavorite
                  ? "bg-amber-50 text-amber-500"
                  : "text-stone-400 hover:bg-stone-100 hover:text-zinc-800"
              }`}
              title="Star note"
            >
              <Star className={`h-4 w-4 ${isFavorite ? "fill-amber-500" : ""}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-zinc-900"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="flex-1 space-y-4 overflow-y-auto p-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Auto-generated if left blank..."
                className="w-full rounded-lg border border-[#d8d4ca] bg-[#faf9f5] px-3 py-2 text-sm text-zinc-900 placeholder:text-stone-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-stone-700">
                Language Mode
              </label>
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
                className="w-full rounded-lg border border-[#d8d4ca] bg-white px-3 py-2 text-sm text-zinc-900 focus:border-zinc-900 focus:outline-none"
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
            <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-stone-700">
                Transcript Text
              </label>
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
                      className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-medium ${
                        speaking
                          ? "border-red-200 bg-red-50 text-red-700"
                          : "border-[#d8d4ca] bg-white text-zinc-800 hover:bg-stone-50"
                      }`}
                    >
                      {speaking ? (
                        <>
                          <VolumeX className="h-3 w-3" />
                          <span>Stop</span>
                        </>
                      ) : (
                        <>
                          <Volume2 className="h-3 w-3" />
                          <span>Read Aloud</span>
                        </>
                      )}
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleCopy}
                  className="inline-flex items-center gap-1 rounded-md border border-[#d8d4ca] bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-stone-50"
                >
                  {copied ? (
                    <>
                      <Check className="h-3 w-3 text-emerald-600" />
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
                  className="inline-flex items-center gap-1 rounded-md border border-[#d8d4ca] bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 hover:bg-stone-50"
                >
                  <Download className="h-3 w-3" />
                  <span>.TXT</span>
                </button>
              </div>
            </div>
            <textarea
              rows={6}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Enter or edit multilingual transcript text (Hindi, English, Hinglish...)"
              className="w-full rounded-lg border border-[#d8d4ca] bg-[#faf9f5] p-3 text-sm leading-relaxed text-zinc-900 placeholder:text-stone-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-stone-700">
              Notes / Context
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional meeting notes or context..."
              className="w-full rounded-lg border border-[#d8d4ca] bg-[#faf9f5] p-3 text-sm text-zinc-900 placeholder:text-stone-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          {initial && initial.segments && initial.segments.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-medium text-stone-500">
                Captured Segments ({initial.segments.length})
              </p>
              <div className="max-h-32 space-y-1.5 overflow-y-auto rounded-lg border border-[#e5e2da] bg-[#faf9f5] p-3">
                {initial.segments.map((seg) => (
                  <div
                    key={seg.id}
                    className="flex items-start gap-2.5 text-xs text-zinc-700"
                  >
                    <span className="shrink-0 font-mono text-[11px] text-stone-400">
                      {seg.timestamp}
                    </span>
                    <span className="flex-1">{seg.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 border-t border-[#ece9e2] pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#d8d4ca] bg-white px-4 py-2 text-xs font-medium text-stone-700 hover:bg-stone-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg bg-zinc-900 px-4 py-2 text-xs font-semibold text-white transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <Save className="h-3.5 w-3.5" />
              <span>{saving ? "Saving..." : "Save Note"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
