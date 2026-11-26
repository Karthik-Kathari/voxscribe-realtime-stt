import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Edit3,
  Search,
  Star,
  Trash2,
  Volume2,
  VolumeX,
} from "lucide-react";
import {
  LANGUAGE_OPTIONS,
  formatDuration,
  type Transcription,
} from "../types";
import { isTtsSupported, speakText, stopSpeaking } from "../lib/tts";

interface HistoryDashboardProps {
  items: Transcription[];
  total: number;
  loading: boolean;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  languageFilter: string;
  onLanguageFilterChange: (value: string) => void;
  engineFilter: string;
  onEngineFilterChange: (value: string) => void;
  favoriteOnly: boolean;
  onFavoriteOnlyChange: (value: boolean) => void;
  sortOrder: "newest" | "oldest" | "longest";
  onSortOrderChange: (value: "newest" | "oldest" | "longest") => void;
  onEdit: (item: Transcription) => void;
  onToggleFavorite: (item: Transcription) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
}

export function HistoryDashboard({
  items,
  total,
  loading,
  searchQuery,
  onSearchChange,
  languageFilter,
  onLanguageFilterChange,
  engineFilter,
  onEngineFilterChange,
  favoriteOnly,
  onFavoriteOnlyChange,
  sortOrder,
  onSortOrderChange,
  onEdit,
  onToggleFavorite,
  onDelete,
  onBulkDelete,
}: HistoryDashboardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

  const allSelected =
    items.length > 0 && items.every((item) => selectedIds.includes(item.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(items.map((item) => item.id));
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    await onBulkDelete(selectedIds);
    setSelectedIds([]);
  };

  const handleCopy = async (item: Transcription) => {
    await navigator.clipboard.writeText(item.content);
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleExportJson = (item: Transcription) => {
    const blob = new Blob([JSON.stringify(item, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${item.title.replace(/[^a-z0-9-_]+/gi, "_") || "transcript"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleSpeak = (item: Transcription) => {
    if (speakingId === item.id) {
      stopSpeaking();
      setSpeakingId(null);
      return;
    }
    speakText(item.content, item.language, {
      onStart: () => setSpeakingId(item.id),
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  return (
    <section className="rounded-2xl border border-slate-800/90 bg-slate-900/60 shadow-xl">
      <div className="border-b border-slate-800/80 px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-white">
              Transcription History Dashboard
            </h2>
            <p className="text-xs text-slate-400">
              Stored in PostgreSQL &middot; {total}{" "}
              {total === 1 ? "record" : "records"} matching current filters
            </p>
          </div>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={handleBulkDelete}
              className="inline-flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-500/15 px-3 py-1.5 text-xs font-medium text-rose-300 transition hover:bg-rose-500/25"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Selected ({selectedIds.length})</span>
            </button>
          )}
        </div>

        <div className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search Hindi, English, Hinglish text or notes..."
              className="w-full rounded-lg border border-slate-700/80 bg-slate-950 py-2 pl-9 pr-3 text-xs text-white placeholder:text-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <select
            value={languageFilter}
            onChange={(e) => onLanguageFilterChange(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Languages</option>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          <select
            value={engineFilter}
            onChange={(e) => onEngineFilterChange(e.target.value)}
            className="rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
          >
            <option value="all">All Engines</option>
            <option value="gemini-live-3.1">Gemini Live 3.1</option>
            <option value="faster-whisper">Faster-Whisper (OSS)</option>
            <option value="web-speech">Browser Speech API</option>
            <option value="manual">Manual Entry</option>
          </select>

          <div className="flex items-center gap-2">
            <select
              value={sortOrder}
              onChange={(e) =>
                onSortOrderChange(
                  e.target.value as "newest" | "oldest" | "longest"
                )
              }
              className="flex-1 rounded-lg border border-slate-700/80 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Most Words</option>
            </select>

            <button
              type="button"
              onClick={() => onFavoriteOnlyChange(!favoriteOnly)}
              className={`rounded-lg border px-2.5 py-2 text-xs font-medium transition ${
                favoriteOnly
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-300"
                  : "border-slate-700/80 bg-slate-950 text-slate-400 hover:text-slate-200"
              }`}
              title="Filter favorites only"
            >
              <Star
                className={`h-3.5 w-3.5 ${favoriteOnly ? "fill-amber-400" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between border-b border-slate-800/60 bg-slate-950/40 px-5 py-2 text-xs text-slate-400 sm:px-6">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0"
            />
            <span>Select all on page</span>
          </label>
          <span>Click Edit to modify text, notes, or export</span>
        </div>
      )}

      <div className="divide-y divide-slate-800/60">
        {loading ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">
            Loading transcription history from PostgreSQL...
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-slate-300">
              No transcriptions found
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Start speaking above or click &ldquo;New Entry&rdquo; to create your first saved transcript.
            </p>
          </div>
        ) : (
          items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isSpeaking = speakingId === item.id;
            const isConfirming = confirmDeleteId === item.id;

            return (
              <article
                key={item.id}
                className={`group px-5 py-4 transition sm:px-6 ${
                  isSelected ? "bg-indigo-500/5" : "hover:bg-slate-800/30"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(item.id)}
                    className="mt-1 h-3.5 w-3.5 rounded border-slate-600 bg-slate-900 text-indigo-500 focus:ring-0"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-white">
                          {item.title}
                        </h3>
                        <span className="rounded-md border border-slate-700 bg-slate-800/80 px-2 py-0.5 text-[11px] font-medium text-slate-300">
                          {item.engine}
                        </span>
                        {item.detectedLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="rounded-md border border-cyan-500/20 bg-cyan-500/10 px-2 py-0.5 text-[11px] font-medium text-cyan-300"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item)}
                          className={`rounded-lg p-1.5 transition ${
                            item.isFavorite
                              ? "text-amber-400 hover:bg-amber-500/10"
                              : "text-slate-500 hover:bg-slate-800 hover:text-slate-300"
                          }`}
                          title="Toggle favorite"
                        >
                          <Star
                            className={`h-4 w-4 ${
                              item.isFavorite ? "fill-amber-400" : ""
                            }`}
                          />
                        </button>

                        {isTtsSupported() && (
                          <button
                            type="button"
                            onClick={() => handleSpeak(item)}
                            className={`rounded-lg p-1.5 transition ${
                              isSpeaking
                                ? "bg-cyan-500/15 text-cyan-300"
                                : "text-slate-400 hover:bg-slate-800 hover:text-cyan-300"
                            }`}
                            title={
                              isSpeaking
                                ? "Stop reading aloud"
                                : "Read aloud (Text-to-Speech)"
                            }
                          >
                            {isSpeaking ? (
                              <VolumeX className="h-4 w-4" />
                            ) : (
                              <Volume2 className="h-4 w-4" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopy(item)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                          title="Copy transcript"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Copy className="h-4 w-4" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportJson(item)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-white"
                          title="Export JSON"
                        >
                          <Download className="h-4 w-4" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-800 hover:text-indigo-300"
                          title="Edit transcript"
                        >
                          <Edit3 className="h-4 w-4" />
                        </button>

                        {isConfirming ? (
                          <div className="ml-1 flex items-center gap-1 rounded-lg border border-rose-500/40 bg-rose-500/10 px-2 py-0.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDelete(item.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-[11px] font-semibold text-rose-300 hover:text-rose-200"
                            >
                              Confirm
                            </button>
                            <span className="text-slate-600">/</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-slate-400 hover:text-white"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-500/10 hover:text-rose-400"
                            title="Delete transcript"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-slate-200">
                      {item.content}
                    </p>

                    {item.notes && (
                      <p className="mt-2 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-1.5 text-xs text-slate-400">
                        <span className="font-medium text-slate-300">Note:</span>{" "}
                        {item.notes}
                      </p>
                    )}

                    <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                      <span>{item.wordCount} words</span>
                      <span>Duration: {formatDuration(item.durationSeconds)}</span>
                      <span>
                        Created:{" "}
                        {new Date(item.createdAt).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

