import type { EngineStatus } from "../types";
import { VoxLogo } from "./VoxLogo";

export type AppView = "landing" | "studio" | "history";

interface HeaderProps {
  currentView: "studio" | "history";
  status: EngineStatus | null;
  onNavigate: (view: AppView) => void;
  onNewManual: () => void;
  onOpenShortcuts: () => void;
}

export function Header({
  currentView,
  status,
  onNavigate,
  onNewManual,
  onOpenShortcuts,
}: HeaderProps) {
  return (
    <header className="sticky top-0 z-40 bg-surface-container-lowest border-b border-outline-variant">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate("landing")}
            className="flex items-center gap-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg cursor-pointer"
            title="Back to VoxScribe Home"
          >
            <VoxLogo size="sm" />
            <span className="font-headline text-lg font-semibold text-on-surface">
              VoxScribe
            </span>
          </button>

          {/* Workspace Navigation Tabs */}
          <nav
            aria-label="Workspace views"
            className="hidden sm:flex items-center p-1 rounded-lg bg-surface-container-low border border-outline-variant gap-1"
          >
            <button
              type="button"
              onClick={() => onNavigate("studio")}
              aria-current={currentView === "studio" ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition duration-150 cursor-pointer ${
                currentView === "studio"
                  ? "bg-surface-container-high text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <span
                className={`material-symbols-outlined text-base ${
                  currentView === "studio" ? "text-primary" : ""
                }`}
                aria-hidden="true"
              >
                graphic_eq
              </span>
              <span>Studio</span>
            </button>

            <button
              type="button"
              onClick={() => onNavigate("history")}
              aria-current={currentView === "history" ? "page" : undefined}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-medium transition duration-150 cursor-pointer ${
                currentView === "history"
                  ? "bg-surface-container-high text-on-surface"
                  : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container"
              }`}
            >
              <span
                className={`material-symbols-outlined text-base ${
                  currentView === "history" ? "text-primary" : ""
                }`}
                aria-hidden="true"
              >
                library_books
              </span>
              <span>History Library</span>
            </button>
          </nav>
        </div>

        <div className="flex items-center gap-2.5">
          <span
            className={`hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium ${
              status?.databaseConnected ? "text-success" : "text-warning"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status?.databaseConnected ? "bg-success" : "bg-warning"
              }`}
              aria-hidden="true"
            />
            <span>
              {status?.databaseConnected ? "Postgres Connected" : "Checking DB"}
            </span>
          </span>

          <span
            className={`hidden md:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium ${
              status?.geminiConfigured ? "text-secondary" : "text-outline"
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                status?.geminiConfigured ? "bg-secondary" : "bg-outline"
              }`}
              aria-hidden="true"
            />
            <span>
              {status?.geminiConfigured
                ? "Gemini Audio Ready"
                : "Gemini Key Unset"}
            </span>
          </span>

          <button
            type="button"
            onClick={onOpenShortcuts}
            title="Keyboard shortcuts (?)"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface-variant hover:text-on-surface hover:bg-surface-container text-xs font-medium transition duration-150 cursor-pointer"
          >
            <span
              className="material-symbols-outlined text-base"
              aria-hidden="true"
            >
              keyboard
            </span>
            <span className="hidden sm:inline">Shortcuts</span>
          </button>

          <button
            type="button"
            onClick={onNewManual}
            title="Create new manual note (N)"
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary text-xs font-medium transition duration-150 cursor-pointer"
          >
            <span
              className="material-symbols-outlined text-base"
              aria-hidden="true"
            >
              add
            </span>
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* Mobile Nav Row */}
      <div className="sm:hidden border-t border-outline-variant px-4 py-2 flex items-center gap-2 bg-surface-container-low">
        <button
          type="button"
          onClick={() => onNavigate("studio")}
          className={`flex-1 text-center py-1.5 rounded-sm text-xs font-medium ${
            currentView === "studio"
              ? "bg-surface-container-high text-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          Studio
        </button>
        <button
          type="button"
          onClick={() => onNavigate("history")}
          className={`flex-1 text-center py-1.5 rounded-sm text-xs font-medium ${
            currentView === "history"
              ? "bg-surface-container-high text-on-surface"
              : "text-on-surface-variant"
          }`}
        >
          History Library
        </button>
      </div>
    </header>
  );
}
