import { useState, type RefObject } from "react";
import {
  LANGUAGE_OPTIONS,
  formatDuration,
  type Transcription,
} from "../types";
import { isTtsSupported, speakText, stopSpeaking } from "../lib/tts";
import { TtsSpeedControl } from "./TtsSpeedControl";

interface HistoryDashboardProps {
  items: Transcription[];
  total: number;
  loading: boolean;
  ttsRate: number;
  onTtsRateChange: (rate: number) => void;
  searchInputRef: RefObject<HTMLInputElement | null>;
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
  onRefresh: () => Promise<void>;
  onEdit: (item: Transcription) => void;
  onToggleFavorite: (item: Transcription) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onBulkDelete: (ids: string[]) => Promise<void>;
  onGoToStudio: () => void;
  onToast: (msg: string) => void;
}

export function HistoryDashboard({
  items,
  total,
  loading,
  ttsRate,
  onTtsRateChange,
  searchInputRef,
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
  onRefresh,
  onEdit,
  onToggleFavorite,
  onDelete,
  onBulkDelete,
  onGoToStudio,
  onToast,
}: HistoryDashboardProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [deletingItem, setDeletingItem] = useState<Transcription | null>(null);
  const [deletingBusy, setDeletingBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);

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
    onToast(`Copied "${item.title}"`);
    setTimeout(() => setCopiedId(null), 1600);
  };

  const handleExportAllMarkdown = () => {
    if (items.length === 0) return;
    const md = items
      .map(
        (item) =>
          `## ${item.title}\n- **Language:** ${item.language} | **Engine:** ${item.engine} | **Words:** ${item.wordCount} | **Date:** ${new Date(item.createdAt).toLocaleString()}\n\n${item.content}${item.notes ? `\n\n> Note: ${item.notes}` : ""}\n`
      )
      .join("\n---\n\n");
    const blob = new Blob([`# VoxScribe History Library\n\n${md}`], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "voxscribe_history.md";
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

  const confirmDelete = async () => {
    if (!deletingItem) return;
    setDeletingBusy(true);
    try {
      await onDelete(deletingItem.id);
      setSelectedIds((prev) => prev.filter((id) => id !== deletingItem.id));
      setDeletingItem(null);
    } finally {
      setDeletingBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Library Header & Global TTS Speed */}
      <section className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="font-headline text-[28px] leading-9 font-semibold tracking-tight text-on-surface">
            Saved Transcriptions
          </h1>
          <p className="text-sm text-on-surface-variant tabular-nums">
            {total} {total === 1 ? "entry" : "entries"} in PostgreSQL
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {isTtsSupported() && (
            <TtsSpeedControl rate={ttsRate} onChange={onTtsRateChange} />
          )}

          {items.length > 0 && (
            <button
              type="button"
              onClick={handleExportAllMarkdown}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface hover:bg-surface-container text-xs font-medium transition duration-150 cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-base"
                aria-hidden="true"
              >
                download
              </span>
              <span>Export .MD</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void onRefresh().then(() => onToast("Synced with PostgreSQL"))}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface hover:bg-surface-container text-xs font-medium transition duration-150 cursor-pointer"
          >
            <span
              className="material-symbols-outlined text-base"
              aria-hidden="true"
            >
              refresh
            </span>
            <span>Refresh</span>
          </button>

          {selectedIds.length > 0 && (
            <button
              type="button"
              onClick={() => void handleBulkDelete()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-error-container text-on-error-container text-xs font-medium hover:opacity-90 transition cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-base"
                aria-hidden="true"
              >
                delete
              </span>
              <span>Delete ({selectedIds.length})</span>
            </button>
          )}
        </div>
      </section>

      {/* Search & Filter Bar */}
      <section className="rounded-xl bg-surface-container-low border border-outline-variant p-4 grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
        <div className="md:col-span-5 relative flex items-center">
          <span
            className="material-symbols-outlined text-base text-outline absolute left-3 pointer-events-none"
            aria-hidden="true"
          >
            search
          </span>
          <label htmlFor="historySearchInput" className="sr-only">
            Search transcriptions
          </label>
          <input
            id="historySearchInput"
            ref={searchInputRef}
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search notes, Hindi, Kannada, English... (/)"
            className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant pl-10 pr-8 py-2 text-sm text-on-surface placeholder:text-outline focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 text-outline hover:text-on-surface cursor-pointer"
              aria-label="Clear search"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>

        <div className="md:col-span-3">
          <label htmlFor="langFilter" className="sr-only">
            Filter by language
          </label>
          <select
            id="langFilter"
            value={languageFilter}
            onChange={(e) => onLanguageFilterChange(e.target.value)}
            className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="all">All Languages</option>
            {LANGUAGE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        <div className="md:col-span-2">
          <label htmlFor="engineFilter" className="sr-only">
            Filter by engine
          </label>
          <select
            id="engineFilter"
            value={engineFilter}
            onChange={(e) => onEngineFilterChange(e.target.value)}
            className="w-full rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-2 text-xs font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="all">All Engines</option>
            <option value="gemini-live-3.1">Gemini AI</option>
            <option value="faster-whisper">Faster-Whisper</option>
            <option value="web-speech">Browser Speech</option>
            <option value="manual">Manual Entry</option>
          </select>
        </div>

        <div className="md:col-span-2 flex items-center gap-2">
          <select
            value={sortOrder}
            onChange={(e) =>
              onSortOrderChange(
                e.target.value as "newest" | "oldest" | "longest"
              )
            }
            aria-label="Sort order"
            className="flex-1 rounded-lg bg-surface-container-lowest border border-outline-variant px-2.5 py-2 text-xs font-medium text-on-surface focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none"
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="longest">Most Words</option>
          </select>
          <button
            type="button"
            onClick={() => onFavoriteOnlyChange(!favoriteOnly)}
            aria-pressed={favoriteOnly}
            aria-label="Filter starred notes"
            className={`w-10 h-9 rounded-lg bg-surface-container-lowest border flex items-center justify-center transition duration-150 cursor-pointer ${
              favoriteOnly
                ? "border-warning text-warning"
                : "border-outline-variant text-on-surface-variant hover:text-warning"
            }`}
          >
            <span
              className="material-symbols-outlined text-base"
              style={{
                fontVariationSettings: `'FILL' ${favoriteOnly ? 1 : 0}`,
              }}
              aria-hidden="true"
            >
              star
            </span>
          </button>
        </div>
      </section>

      {/* Records Grid / Loading / Empty State */}
      {loading ? (
        <section className="rounded-2xl bg-surface-container-low border border-outline-variant p-12 text-center text-sm text-on-surface-variant">
          Loading transcription history from PostgreSQL...
        </section>
      ) : items.length === 0 ? (
        <section className="rounded-2xl bg-surface-container-low border border-outline-variant p-12 flex flex-col items-center justify-center text-center gap-3">
          <span
            className="material-symbols-outlined text-4xl text-outline"
            aria-hidden="true"
          >
            library_books
          </span>
          <h2 className="font-headline text-lg font-semibold text-on-surface">
            No saved transcriptions found
          </h2>
          <p className="text-sm text-on-surface-variant max-w-md">
            Try clearing your search or filters, or open the Studio to record
            your next multilingual voice note.
          </p>
          <button
            type="button"
            onClick={onGoToStudio}
            className="mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary text-xs font-medium transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-base" aria-hidden="true">
              mic
            </span>
            <span>Go to Studio</span>
          </button>
        </section>
      ) : (
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
          {items.map((item) => {
            const isSelected = selectedIds.includes(item.id);
            const isSpeaking = speakingId === item.id;

            return (
              <article
                key={item.id}
                className={`h-full rounded-xl bg-surface-container-low border p-5 flex flex-col justify-between gap-4 transition ${
                  isSelected
                    ? "border-primary bg-surface-container"
                    : "border-outline-variant hover:border-outline"
                }`}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectOne(item.id)}
                        aria-label={`Select ${item.title}`}
                        className="mt-1 rounded border-outline-variant bg-surface-container accent-primary-container cursor-pointer"
                      />
                      <div className="flex flex-col gap-1 min-w-0">
                        <h2 className="font-headline text-lg font-semibold text-on-surface truncate">
                          {item.title}
                        </h2>
                        <span className="font-mono text-xs text-outline tabular-nums">
                          {new Date(item.createdAt).toLocaleString(undefined, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })}{" "}
                          · {formatDuration(item.durationSeconds)} ·{" "}
                          {item.wordCount} words
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => void onToggleFavorite(item)}
                      aria-label="Toggle star"
                      className={`p-1.5 rounded-lg bg-surface-container border border-outline-variant transition cursor-pointer ${
                        item.isFavorite ? "text-warning" : "text-outline hover:text-warning"
                      }`}
                    >
                      <span
                        className="material-symbols-outlined text-base"
                        style={{
                          fontVariationSettings: `'FILL' ${
                            item.isFavorite ? 1 : 0
                          }`,
                        }}
                      >
                        star
                      </span>
                    </button>
                  </div>

                  <p className="text-sm text-on-surface-variant leading-relaxed whitespace-pre-wrap">
                    {item.content}
                  </p>

                  {item.notes && (
                    <p className="rounded-lg bg-surface-container-lowest border border-outline-variant px-3 py-2 text-xs text-on-surface-variant">
                      <span className="font-medium text-on-surface">Note:</span>{" "}
                      {item.notes}
                    </p>
                  )}
                </div>

                <footer className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-outline-variant">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-xs font-medium text-secondary">
                      {item.detectedLanguages[0] || item.language}
                    </span>
                    <span className="px-2.5 py-0.5 rounded-full bg-surface-container-lowest border border-outline-variant font-mono text-xs text-primary">
                      {item.engine}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isTtsSupported() && (
                      <button
                        type="button"
                        onClick={() => handleSpeak(item)}
                        aria-label="Play TTS"
                        title={
                          isSpeaking
                            ? "Stop audio"
                            : `Play TTS (${ttsRate.toFixed(1)}x)`
                        }
                        className={`p-1.5 rounded-lg transition cursor-pointer ${
                          isSpeaking
                            ? "bg-error-container text-on-error-container"
                            : "bg-surface-container-high text-secondary hover:bg-surface-bright"
                        }`}
                      >
                        <span className="material-symbols-outlined text-base">
                          {isSpeaking ? "stop_circle" : "volume_up"}
                        </span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => void handleCopy(item)}
                      aria-label="Copy transcript"
                      className="p-1.5 rounded-lg bg-surface-container-high text-on-surface-variant hover:text-on-surface transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">
                        {copiedId === item.id ? "check" : "content_copy"}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onEdit(item)}
                      className="px-3 py-1.5 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright text-xs font-medium transition cursor-pointer"
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeletingItem(item)}
                      aria-label="Delete record"
                      className="p-1.5 rounded-lg bg-surface-container-high text-error hover:bg-error-container hover:text-on-error-container transition cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-base">
                        delete
                      </span>
                    </button>
                  </div>
                </footer>
              </article>
            );
          })}
        </section>
      )}

      {/* Delete Confirmation Modal */}
      {deletingItem && (
        <div
          className="fixed inset-0 z-50 bg-scrim/70 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="deleteModalTitle"
          onClick={() => !deletingBusy && setDeletingItem(null)}
        >
          <div
            className="w-full max-w-md rounded-xl bg-surface-container border border-outline-variant p-6 flex flex-col gap-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="deleteModalTitle"
              className="font-headline text-lg font-semibold text-on-surface"
            >
              Delete Transcription?
            </h2>
            <p className="text-sm text-on-surface-variant">
              This will permanently remove{" "}
              <strong className="text-on-surface">{deletingItem.title}</strong>{" "}
              from your PostgreSQL history library.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={deletingBusy}
                onClick={() => setDeletingItem(null)}
                className="px-4 py-2 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-bright text-xs font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingBusy}
                onClick={() => void confirmDelete()}
                className="px-4 py-2 rounded-lg bg-error-container text-on-error-container hover:opacity-90 text-xs font-medium disabled:opacity-50 cursor-pointer"
              >
                {deletingBusy ? "Deleting..." : "Delete Record"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
