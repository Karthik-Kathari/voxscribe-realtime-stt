import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { HistoryDashboard } from "./components/HistoryDashboard";
import { LiveTranscriber } from "./components/LiveTranscriber";
import { ShortcutsModal } from "./components/ShortcutsModal";
import { StatsBar } from "./components/StatsBar";
import { TranscriptModal } from "./components/TranscriptModal";
import {
  bulkDeleteTranscriptions,
  createTranscription,
  deleteTranscription,
  fetchHealth,
  fetchStats,
  fetchTranscriptions,
  updateTranscription,
} from "./lib/api";
import {
  getSavedTtsRate,
  saveTtsRate,
  setLivePlaybackRate,
  stopSpeaking,
} from "./lib/tts";
import type {
  EngineStatus,
  TranscriptSegment,
  Transcription,
  TranscriptionStats,
} from "./types";

export function App() {
  const [engineStatus, setEngineStatus] = useState<EngineStatus | null>(null);
  const [stats, setStats] = useState<TranscriptionStats | null>(null);
  const [items, setItems] = useState<Transcription[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [ttsRate, setTtsRate] = useState<number>(() => getSavedTtsRate());

  const [searchQuery, setSearchQuery] = useState("");
  const [languageFilter, setLanguageFilter] = useState("all");
  const [engineFilter, setEngineFilter] = useState("all");
  const [favoriteOnly, setFavoriteOnly] = useState(false);
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest" | "longest">(
    "newest"
  );

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "edit">("create");
  const [editingItem, setEditingItem] = useState<Transcription | null>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const ttsRateRef = useRef(ttsRate);
  ttsRateRef.current = ttsRate;

  const handleTtsRateChange = useCallback((nextRate: number) => {
    const clamped = Math.min(1.8, Math.max(0.6, Number(nextRate.toFixed(1))));
    setTtsRate(clamped);
    saveTtsRate(clamped);
    setLivePlaybackRate(clamped);
  }, []);

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

  // Global app shortcuts: ? (Shortcuts), [ / ] (TTS speed), 0 (Reset speed), N (New Note), / (Search), Esc (Close/Stop)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.defaultPrevented) return;
      if (e.key === "Escape") {
        if (shortcutsOpen) {
          setShortcutsOpen(false);
          return;
        }
        if (modalOpen) {
          setModalOpen(false);
          return;
        }
        stopSpeaking();
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      const tag = target?.tagName;
      const isTyping =
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT" ||
        Boolean(target?.isContentEditable);

      if (isTyping) return;

      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((prev) => !prev);
      } else if (modalOpen || shortcutsOpen) {
        return;
      } else if (e.key === "[") {
        e.preventDefault();
        handleTtsRateChange(ttsRateRef.current - 0.1);
      } else if (e.key === "]") {
        e.preventDefault();
        handleTtsRateChange(ttsRateRef.current + 0.1);
      } else if (e.key === "0") {
        e.preventDefault();
        handleTtsRateChange(1.0);
      } else if (e.key.toLowerCase() === "n") {
        e.preventDefault();
        setModalMode("create");
        setEditingItem(null);
        setModalOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, shortcutsOpen, handleTtsRateChange]);

  const loadHealthAndStats = useCallback(async () => {
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetchHealth(),
        fetchStats(),
      ]);
      setEngineStatus(healthRes);
      setStats(statsRes);
    } catch {
      // handled gracefully by UI status dots
    }
  }, []);

  const loadTranscriptions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchTranscriptions({
        q: searchQuery,
        language: languageFilter,
        engine: engineFilter,
        favorite: favoriteOnly,
        sort: sortOrder,
        limit: 50,
      });
      setItems(res.items);
      setTotal(res.total);
    } catch (err) {
      showToast(
        err instanceof Error ? err.message : "Failed to load history"
      );
    } finally {
      setLoading(false);
    }
  }, [searchQuery, languageFilter, engineFilter, favoriteOnly, sortOrder]);

  useEffect(() => {
    void loadHealthAndStats();
  }, [loadHealthAndStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTranscriptions();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadTranscriptions]);

  const refreshAll = async () => {
    await Promise.all([loadTranscriptions(), loadHealthAndStats()]);
  };

  const handleSaveFromLive = async (payload: {
    id?: string;
    title?: string;
    content: string;
    language: string;
    engine: string;
    durationSeconds: number;
    segments: TranscriptSegment[];
  }): Promise<Transcription> => {
    let saved: Transcription;
    if (payload.id) {
      try {
        saved = await updateTranscription(payload.id, {
          title: payload.title,
          content: payload.content,
          language: payload.language,
          durationSeconds: payload.durationSeconds,
          segments: payload.segments,
        });
        showToast("Updated current note in PostgreSQL");
      } catch {
        // Fallback to creating a new row if the previous note was deleted
        saved = await createTranscription(payload);
        showToast("Saved note to PostgreSQL");
      }
    } else {
      saved = await createTranscription(payload);
      showToast("Saved note to PostgreSQL");
    }
    await refreshAll();
    return saved;
  };

  const handleModalSave = async (payload: {
    id?: string;
    title: string;
    content: string;
    language: string;
    notes: string;
    isFavorite: boolean;
  }) => {
    if (modalMode === "edit" && payload.id) {
      await updateTranscription(payload.id, {
        title: payload.title || undefined,
        content: payload.content,
        language: payload.language,
        notes: payload.notes,
        isFavorite: payload.isFavorite,
      });
      showToast("Note updated");
    } else {
      await createTranscription({
        title: payload.title || undefined,
        content: payload.content,
        language: payload.language,
        engine: "manual",
        durationSeconds: 0,
        notes: payload.notes,
        isFavorite: payload.isFavorite,
      });
      showToast("Note created");
    }
    await refreshAll();
  };

  const handleToggleFavorite = async (item: Transcription) => {
    await updateTranscription(item.id, { isFavorite: !item.isFavorite });
    await refreshAll();
  };

  const handleDelete = async (id: string) => {
    await deleteTranscription(id);
    await refreshAll();
    showToast("Note deleted");
  };

  const handleBulkDelete = async (ids: string[]) => {
    const res = await bulkDeleteTranscriptions(ids);
    await refreshAll();
    showToast(`Deleted ${res.deletedCount} notes`);
  };

  return (
    <div className="min-h-screen bg-[#f5f4ef] text-zinc-900">
      <Header
        status={engineStatus}
        onNewManual={() => {
          setModalMode("create");
          setEditingItem(null);
          setModalOpen(true);
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <StatsBar stats={stats} />

        <LiveTranscriber
          engineStatus={engineStatus}
          ttsRate={ttsRate}
          onTtsRateChange={handleTtsRateChange}
          hotkeyDisabled={modalOpen || shortcutsOpen}
          onSaveTranscription={handleSaveFromLive}
        />

        <HistoryDashboard
          items={items}
          total={total}
          loading={loading}
          ttsRate={ttsRate}
          onTtsRateChange={handleTtsRateChange}
          searchInputRef={searchInputRef}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          languageFilter={languageFilter}
          onLanguageFilterChange={setLanguageFilter}
          engineFilter={engineFilter}
          onEngineFilterChange={setEngineFilter}
          favoriteOnly={favoriteOnly}
          onFavoriteOnlyChange={setFavoriteOnly}
          sortOrder={sortOrder}
          onSortOrderChange={setSortOrder}
          onEdit={(item) => {
            setModalMode("edit");
            setEditingItem(item);
            setModalOpen(true);
          }}
          onToggleFavorite={handleToggleFavorite}
          onDelete={handleDelete}
          onBulkDelete={handleBulkDelete}
        />
      </main>

      <TranscriptModal
        open={modalOpen}
        mode={modalMode}
        initial={editingItem}
        ttsRate={ttsRate}
        onTtsRateChange={handleTtsRateChange}
        onClose={() => setModalOpen(false)}
        onSave={handleModalSave}
      />

      <ShortcutsModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
