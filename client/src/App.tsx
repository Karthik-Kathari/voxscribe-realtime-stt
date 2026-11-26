import { useCallback, useEffect, useRef, useState } from "react";
import { StudioFooter } from "./components/Footer";
import { Header, type AppView } from "./components/Header";
import { HistoryDashboard } from "./components/HistoryDashboard";
import { LandingPage } from "./components/LandingPage";
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

function resolveViewFromPath(pathname: string): AppView {
  if (pathname.startsWith("/studio")) return "studio";
  if (pathname.startsWith("/history")) return "history";
  return "landing";
}

function viewToPath(view: AppView): string {
  if (view === "studio") return "/studio";
  if (view === "history") return "/history";
  return "/";
}

export function App() {
  const [view, setView] = useState<AppView>(() =>
    resolveViewFromPath(window.location.pathname)
  );
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

  const navigate = useCallback((nextView: AppView) => {
    setView(nextView);
    const targetPath = viewToPath(nextView);
    if (window.location.pathname !== targetPath) {
      window.history.pushState({}, "", targetPath);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setView(resolveViewFromPath(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const handleTtsRateChange = useCallback((nextRate: number) => {
    const clamped = Math.min(1.8, Math.max(0.6, Number(nextRate.toFixed(1))));
    setTtsRate(clamped);
    saveTtsRate(clamped);
    setLivePlaybackRate(clamped);
  }, []);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2600);
  }, []);

  // Global keyboard shortcuts
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
      } else if (e.key.toLowerCase() === "n" && view !== "landing") {
        e.preventDefault();
        setModalMode("create");
        setEditingItem(null);
        setModalOpen(true);
      } else if (e.key === "/") {
        e.preventDefault();
        if (view !== "history") {
          navigate("history");
          window.setTimeout(() => searchInputRef.current?.focus(), 60);
        } else {
          searchInputRef.current?.focus();
        }
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [modalOpen, shortcutsOpen, view, navigate, handleTtsRateChange]);

  const loadHealthAndStats = useCallback(async () => {
    try {
      const [healthRes, statsRes] = await Promise.all([
        fetchHealth(),
        fetchStats(),
      ]);
      setEngineStatus(healthRes);
      setStats(statsRes);
    } catch {
      // handled gracefully by header status indicators
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
      showToast(err instanceof Error ? err.message : "Failed to load history");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, languageFilter, engineFilter, favoriteOnly, sortOrder, showToast]);

  useEffect(() => {
    void loadHealthAndStats();
  }, [loadHealthAndStats]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadTranscriptions();
    }, 150);
    return () => clearTimeout(timer);
  }, [loadTranscriptions]);

  const refreshAll = useCallback(async () => {
    await Promise.all([loadTranscriptions(), loadHealthAndStats()]);
  }, [loadTranscriptions, loadHealthAndStats]);

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
        saved = await createTranscription(payload);
        showToast("Saved transcription to PostgreSQL");
      }
    } else {
      saved = await createTranscription(payload);
      showToast("Saved transcription to PostgreSQL");
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
      showToast("Updated record in PostgreSQL");
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
      showToast("Saved transcription to PostgreSQL");
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
    showToast("Record deleted");
  };

  const handleBulkDelete = async (ids: string[]) => {
    const res = await bulkDeleteTranscriptions(ids);
    await refreshAll();
    showToast(`Deleted ${res.deletedCount} records`);
  };

  if (view === "landing") {
    return (
      <LandingPage
        onNavigateStudio={() => navigate("studio")}
        onNavigateHistory={() => navigate("history")}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface">
      <Header
        currentView={view}
        status={engineStatus}
        onNavigate={navigate}
        onNewManual={() => {
          setModalMode("create");
          setEditingItem(null);
          setModalOpen(true);
        }}
        onOpenShortcuts={() => setShortcutsOpen(true)}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 lg:px-8 py-6 lg:py-8 pb-20 flex flex-col gap-6">
        {view === "studio" ? (
          <>
            <StatsBar stats={stats} />
            <LiveTranscriber
              engineStatus={engineStatus}
              ttsRate={ttsRate}
              onTtsRateChange={handleTtsRateChange}
              hotkeyDisabled={modalOpen || shortcutsOpen}
              onSaveTranscription={handleSaveFromLive}
              onToast={showToast}
            />
          </>
        ) : (
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
            onRefresh={refreshAll}
            onEdit={(item) => {
              setModalMode("edit");
              setEditingItem(item);
              setModalOpen(true);
            }}
            onToggleFavorite={handleToggleFavorite}
            onDelete={handleDelete}
            onBulkDelete={handleBulkDelete}
            onGoToStudio={() => navigate("studio")}
            onToast={showToast}
          />
        )}
      </main>

      <StudioFooter />

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
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 right-6 z-50 rounded-lg bg-surface-container-high border border-primary px-4 py-2.5 text-xs font-medium text-on-surface shadow-lg"
        >
          {toast}
        </div>
      )}
    </div>
  );
}

export default App;
