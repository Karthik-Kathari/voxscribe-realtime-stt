import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { HistoryDashboard } from "./components/HistoryDashboard";
import { LiveTranscriber } from "./components/LiveTranscriber";
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
  const [toast, setToast] = useState<string | null>(null);

  const handleTtsRateChange = (nextRate: number) => {
    const clamped = Math.min(1.8, Math.max(0.6, Number(nextRate.toFixed(1))));
    setTtsRate(clamped);
    saveTtsRate(clamped);
    setLivePlaybackRate(clamped);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2800);
  };

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
    title?: string;
    content: string;
    language: string;
    engine: string;
    durationSeconds: number;
    segments: TranscriptSegment[];
  }) => {
    await createTranscription(payload);
    await refreshAll();
    showToast("Saved note to PostgreSQL");
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
      />

      <main className="mx-auto max-w-6xl space-y-5 px-4 py-6 sm:px-6">
        <StatsBar stats={stats} />

        <LiveTranscriber
          engineStatus={engineStatus}
          ttsRate={ttsRate}
          onTtsRateChange={handleTtsRateChange}
          hotkeyDisabled={modalOpen}
          onSaveTranscription={handleSaveFromLive}
        />

        <HistoryDashboard
          items={items}
          total={total}
          loading={loading}
          ttsRate={ttsRate}
          onTtsRateChange={handleTtsRateChange}
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

      {toast && (
        <div className="fixed bottom-5 right-5 z-50 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
