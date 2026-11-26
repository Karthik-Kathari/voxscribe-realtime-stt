import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Edit3,
  Gauge,
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
  ttsRate: number;
  onTtsRateChange: (rate: number) => void;
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
  ttsRate,
  onTtsRateChange,
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
    void speakText(item.content, item.language, {
      rate: ttsRate,
      onStart: () => setSpeakingId(item.id),
      onEnd: () => setSpeakingId(null),
      onError: () => setSpeakingId(null),
    });
  };

  return (
    <section className="rounded-xl border border-[#e5e2da] bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="border-b border-[#ece9e2] px-5 py-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-semibold text-zinc-900">
              Saved Transcriptions
            </h2>
            <p className="text-xs text-stone-500">
              {total} {total === 1 ? "entry" : "entries"} in PostgreSQL
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isTtsSupported() && (
              <div className="flex items-center gap-2 rounded-lg border border-[#e5e2da] bg-[#faf9f5] px-2.5 py-1">
                <Gauge className="h-3.5 w-3.5 text-stone-500" />
                <span className="text-[11px] font-medium text-stone-600">
                  TTS Speed
                </span>
                <input
                  type="range"
                  min="0.6"
                  max="1.8"
                  step="0.1"
                  value={ttsRate}
                  onChange={(e) => onTtsRateChange(Number(e.target.value))}
                  className="h-1.5 w-20 cursor-pointer accent-zinc-900"
                  title="Adjust playback speed for Read Aloud"
                />
                <span className="w-8 text-right font-mono text-[11px] font-medium text-zinc-800">
                  {ttsRate.toFixed(1)}x
                </span>
              </div>
            )}

            {selectedIds.length > 0 && (
              <button
                type="button"
                onClick={handleBulkDelete}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-100"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>Delete Selected ({selectedIds.length})</span>
              </button>
            )}
          </div>
        </div>

        <div className="mt-3.5 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-stone-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search notes, Hindi/English text..."
              className="w-full rounded-lg border border-[#d8d4ca] bg-[#faf9f5] py-1.5 pl-8 pr-3 text-xs text-zinc-900 placeholder:text-stone-400 focus:border-zinc-900 focus:bg-white focus:outline-none"
            />
          </div>

          <select
            value={languageFilter}
            onChange={(e) => onLanguageFilterChange(e.target.value)}
            className="rounded-lg border border-[#d8d4ca] bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-zinc-900 focus:outline-none"
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
            className="rounded-lg border border-[#d8d4ca] bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-zinc-900 focus:outline-none"
          >
            <option value="all">All Engines</option>
            <option value="gemini-live-3.1">Gemini Live 3.1</option>
            <option value="faster-whisper">Faster-Whisper (OSS)</option>
            <option value="web-speech">Browser Speech</option>
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
              className="flex-1 rounded-lg border border-[#d8d4ca] bg-white px-2.5 py-1.5 text-xs text-zinc-800 focus:border-zinc-900 focus:outline-none"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="longest">Most Words</option>
            </select>

            <button
              type="button"
              onClick={() => onFavoriteOnlyChange(!favoriteOnly)}
              className={`rounded-lg border px-2.5 py-1.5 text-xs transition ${
                favoriteOnly
                  ? "border-amber-300 bg-amber-50 text-amber-700"
                  : "border-[#d8d4ca] bg-white text-stone-500 hover:text-zinc-900"
              }`}
              title="Starred only"
            >
              <Star
                className={`h-3.5 w-3.5 ${favoriteOnly ? "fill-amber-500 text-amber-500" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {items.length > 0 && (
        <div className="flex items-center justify-between border-b border-[#ece9e2] bg-[#faf9f5] px-5 py-2 text-xs text-stone-500 sm:px-6">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleSelectAll}
              className="h-3.5 w-3.5 rounded border-stone-300 accent-zinc-900"
            />
            <span>Select all</span>
          </label>
          <span className="hidden sm:inline">
            Edit, star, export, or play any note aloud
          </span>
        </div>
      )}

      <div className="divide-y divide-[#ece9e2]">
        {loading ? (
          <div className="px-6 py-10 text-center text-xs text-stone-500">
            Loading notes from PostgreSQL...
          </div>
        ) : items.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm font-medium text-zinc-800">
              No saved transcriptions yet
            </p>
            <p className="mt-1 text-xs text-stone-500">
              Press Space to record your first voice note or click &ldquo;New Note&rdquo;.
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
                className={`px-5 py-4 transition sm:px-6 ${
                  isSelected ? "bg-amber-50/50" : "hover:bg-[#faf9f5]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => toggleSelectOne(item.id)}
                    className="mt-1 h-3.5 w-3.5 rounded border-stone-300 accent-zinc-900"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-zinc-900">
                          {item.title}
                        </h3>
                        <span className="rounded border border-[#e5e2da] bg-[#f5f4ef] px-1.5 py-0.5 font-mono text-[10px] text-stone-600">
                          {item.engine}
                        </span>
                        {item.detectedLanguages.map((lang) => (
                          <span
                            key={lang}
                            className="rounded border border-[#e5e2da] bg-white px-1.5 py-0.5 text-[10px] font-medium text-stone-600"
                          >
                            {lang}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => onToggleFavorite(item)}
                          className={`rounded-md p-1.5 transition ${
                            item.isFavorite
                              ? "text-amber-500 hover:bg-amber-50"
                              : "text-stone-400 hover:bg-stone-100 hover:text-zinc-700"
                          }`}
                          title="Star note"
                        >
                          <Star
                            className={`h-3.5 w-3.5 ${
                              item.isFavorite ? "fill-amber-500" : ""
                            }`}
                          />
                        </button>

                        {isTtsSupported() && (
                          <button
                            type="button"
                            onClick={() => handleSpeak(item)}
                            className={`rounded-md p-1.5 transition ${
                              isSpeaking
                                ? "bg-red-50 text-red-600"
                                : "text-stone-400 hover:bg-stone-100 hover:text-zinc-900"
                            }`}
                            title={
                              isSpeaking
                                ? "Stop reading aloud"
                                : `Read aloud (${ttsRate.toFixed(1)}x)`
                            }
                          >
                            {isSpeaking ? (
                              <VolumeX className="h-3.5 w-3.5" />
                            ) : (
                              <Volume2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopy(item)}
                          className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-zinc-900"
                          title="Copy text"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleExportJson(item)}
                          className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-zinc-900"
                          title="Export JSON"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => onEdit(item)}
                          className="rounded-md p-1.5 text-stone-400 transition hover:bg-stone-100 hover:text-zinc-900"
                          title="Edit note"
                        >
                          <Edit3 className="h-3.5 w-3.5" />
                        </button>

                        {isConfirming ? (
                          <div className="ml-1 flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-2 py-0.5">
                            <button
                              type="button"
                              onClick={async () => {
                                await onDelete(item.id);
                                setConfirmDeleteId(null);
                              }}
                              className="text-[11px] font-semibold text-red-700 hover:text-red-800"
                            >
                              Delete
                            </button>
                            <span className="text-red-300">/</span>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="text-[11px] text-stone-600 hover:text-zinc-900"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteId(item.id)}
                            className="rounded-md p-1.5 text-stone-400 transition hover:bg-red-50 hover:text-red-600"
                            title="Delete note"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">
                      {item.content}
                    </p>

                    {item.notes && (
                      <p className="mt-2 rounded-md border border-[#e5e2da] bg-[#faf9f5] px-3 py-1.5 text-xs text-stone-600">
                        <span className="font-medium text-zinc-800">Note:</span>{" "}
                        {item.notes}
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px] text-stone-400">
                      <span>{item.wordCount} words</span>
                      <span>{formatDuration(item.durationSeconds)}</span>
                      <span>
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
