import { useState } from "react";
import { VoxLogo } from "./VoxLogo";

interface LandingPageProps {
  onNavigateStudio: () => void;
  onNavigateHistory: () => void;
}

const PREVIEW_ENGINES = {
  gemini: {
    label: "Gemini AI",
    status: "Gemini AI · Streaming",
    text: '"Hello team, aaj ka standup 5 minute mein start karte hain. Faster-Whisper aur Gemini audio pipeline dono test ho chuke hain, and latency feels super responsive."',
  },
  whisper: {
    label: "Faster-Whisper",
    status: "Faster-Whisper · Local/Server",
    text: '"Namaskara Bengaluru! ಇವತ್ತು product demo record maadta iddini — switching between Kannada and English works cleanly with Whisper."',
  },
  browser: {
    label: "Browser Speech",
    status: "Browser Speech · Zero-Latency",
    text: '"Quick voice note for tonight: update the PostgreSQL search index and push the open-source release notes to GitHub."',
  },
} as const;

type PreviewKey = keyof typeof PREVIEW_ENGINES;

export function LandingPage({
  onNavigateStudio,
  onNavigateHistory,
}: LandingPageProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [previewEngine, setPreviewEngine] = useState<PreviewKey>("gemini");
  const activePreview = PREVIEW_ENGINES[previewEngine];

  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface">
      {/* Sticky Navigation */}
      <header className="sticky top-0 z-40 bg-surface-container-lowest border-b border-outline-variant">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 h-16 flex items-center justify-between gap-4">
          <a
            href="#product"
            className="flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg"
          >
            <VoxLogo size="md" />
            <span className="flex items-center gap-2.5">
              <span className="font-headline text-lg font-semibold tracking-tight text-on-surface">
                VoxScribe
              </span>
              <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant text-secondary text-xs font-medium tracking-wide">
                FREE &amp; OPEN SOURCE
              </span>
            </span>
          </a>

          <nav aria-label="Primary" className="hidden md:flex items-center gap-6">
            <a
              href="#product"
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition duration-150"
            >
              Product
            </a>
            <a
              href="#features"
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition duration-150"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition duration-150"
            >
              How It Works
            </a>
            <a
              href="#open-source"
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition duration-150"
            >
              Open Source
            </a>
            <a
              href="https://github.com/Karthik-Kathari/voxscribe-realtime-stt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-on-surface-variant hover:text-on-surface transition duration-150 inline-flex items-center gap-1"
            >
              <span>GitHub</span>
              <span
                className="material-symbols-outlined text-xs"
                aria-hidden="true"
              >
                open_in_new
              </span>
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onNavigateStudio}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
            >
              <span
                className="material-symbols-outlined text-base"
                aria-hidden="true"
              >
                mic
              </span>
              <span className="text-sm font-medium whitespace-nowrap">
                Launch App
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigation menu"
              aria-expanded={mobileMenuOpen}
              className="md:hidden inline-flex items-center justify-center w-10 h-10 rounded-lg bg-surface-container-low border border-outline-variant text-on-surface"
            >
              <span
                className="material-symbols-outlined text-lg"
                aria-hidden="true"
              >
                {mobileMenuOpen ? "close" : "menu"}
              </span>
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-outline-variant bg-surface-container-low px-4 py-4 flex flex-col gap-3">
            <a
              href="#product"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-on-surface-variant py-1"
            >
              Product
            </a>
            <a
              href="#features"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-on-surface-variant py-1"
            >
              Features
            </a>
            <a
              href="#how-it-works"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-on-surface-variant py-1"
            >
              How It Works
            </a>
            <a
              href="#open-source"
              onClick={() => setMobileMenuOpen(false)}
              className="text-sm font-medium text-on-surface-variant py-1"
            >
              Open Source
            </a>
            <a
              href="https://github.com/Karthik-Kathari/voxscribe-realtime-stt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-secondary py-1"
            >
              GitHub Repository
            </a>
          </div>
        )}
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section
          id="product"
          className="relative overflow-hidden border-b border-outline-variant bg-surface"
        >
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-20 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <div className="lg:col-span-6 flex flex-col gap-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant text-secondary text-xs font-medium">
                  <span
                    className="w-2 h-2 rounded-full bg-success"
                    aria-hidden="true"
                  />
                  <span>100% Free &amp; Open-Source AI Speech Studio</span>
                </span>
              </div>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] lg:leading-[64px] tracking-[-1.2px] font-bold text-on-surface text-balance">
                Your Voice, Without Language Barriers.
              </h1>

              <p className="text-base leading-[26px] text-on-surface-variant max-w-prose text-pretty">
                Meet your intelligent multilingual speech companion. Transcribe
                Hinglish and 8+ Indian languages in real time, switch between
                powerful AI engines, and turn conversations into searchable text
                — completely free.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onNavigateStudio}
                  className="inline-flex items-center justify-center gap-2.5 px-6 py-3 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer"
                >
                  <span
                    className="material-symbols-outlined text-lg"
                    aria-hidden="true"
                  >
                    mic
                  </span>
                  <span className="text-sm font-medium">
                    Start Transcribing — It&apos;s Free
                  </span>
                </button>

                <a
                  href="https://github.com/Karthik-Kathari/voxscribe-realtime-stt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-bright transition duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                >
                  <span
                    className="material-symbols-outlined text-base text-secondary"
                    aria-hidden="true"
                  >
                    code
                  </span>
                  <span className="text-sm font-medium">Explore on GitHub</span>
                </a>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2">
                <span className="text-xs font-medium text-outline mr-1">
                  Native support:
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium text-on-surface">
                  Hinglish
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium text-on-surface-variant">
                  हिन्दी Hindi
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium text-on-surface-variant">
                  ಕನ್ನಡ Kannada
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium text-on-surface-variant">
                  தமிழ் Tamil
                </span>
                <span className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium text-on-surface-variant">
                  తెలుగు Telugu
                </span>
                <button
                  type="button"
                  onClick={onNavigateStudio}
                  className="px-2.5 py-1 rounded-full bg-surface-container-low border border-outline-variant text-xs font-medium text-secondary hover:bg-surface-container-high transition cursor-pointer"
                >
                  +5 more
                </button>
              </div>
            </div>

            {/* Authentic Live Product Preview */}
            <div className="lg:col-span-6">
              <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant p-5 flex flex-col gap-4">
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-outline-variant">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full bg-recording"
                      aria-hidden="true"
                    />
                    <span className="font-mono text-xs font-medium text-on-surface tabular-nums">
                      LIVE · 00:42
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-1 p-1 rounded-lg bg-surface-container-low border border-outline-variant">
                    {(["gemini", "whisper", "browser"] as const).map((key) => {
                      const active = previewEngine === key;
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPreviewEngine(key)}
                          className={`px-2.5 py-1 rounded-sm text-xs font-medium whitespace-nowrap transition duration-150 cursor-pointer ${
                            active
                              ? "bg-primary-container text-on-primary-container"
                              : "text-on-surface-variant hover:text-on-surface"
                          }`}
                        >
                          {PREVIEW_ENGINES[key].label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Live Waveform Bar */}
                <div className="rounded-lg bg-surface-container-low border border-outline-variant px-4 py-3 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span
                      className="w-9 h-9 rounded-full bg-recording text-on-recording flex items-center justify-center"
                      aria-hidden="true"
                    >
                      <span className="material-symbols-outlined text-base">
                        mic
                      </span>
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-on-surface">
                        Hinglish (Hindi + English)
                      </span>
                      <span className="font-mono text-xs text-secondary">
                        {activePreview.status}
                      </span>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 h-8"
                    aria-hidden="true"
                  >
                    {[
                      { h: "h-4", c: "bg-primary", d: "0ms" },
                      { h: "h-7", c: "bg-secondary", d: "140ms" },
                      { h: "h-5", c: "bg-primary", d: "280ms" },
                      { h: "h-8", c: "bg-secondary", d: "80ms" },
                      { h: "h-6", c: "bg-primary", d: "220ms" },
                      { h: "h-4", c: "bg-secondary", d: "340ms" },
                      { h: "h-7", c: "bg-primary", d: "180ms" },
                      { h: "h-5", c: "bg-secondary", d: "60ms" },
                    ].map((bar, idx) => (
                      <span
                        key={idx}
                        className={`wave-bar w-1 ${bar.h} rounded-full ${bar.c}`}
                        style={{ animationDelay: bar.d }}
                      />
                    ))}
                  </div>
                </div>

                {/* Live Transcript Output Preview */}
                <div className="rounded-lg bg-surface-container border border-outline-variant p-4 flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-outline">
                      Live Transcription
                    </span>
                    <span className="font-mono text-xs text-success tabular-nums">
                      Postgres synced
                    </span>
                  </div>
                  <p className="text-base text-on-surface leading-relaxed">
                    {activePreview.text}
                  </p>
                  <div className="flex items-center justify-between pt-2 border-t border-outline-variant">
                    <span className="font-mono text-xs text-outline tabular-nums">
                      26 words · 1.0x Neural TTS
                    </span>
                    <button
                      type="button"
                      onClick={onNavigateStudio}
                      className="px-3 py-1 rounded-lg bg-surface-container-high text-on-surface hover:bg-surface-bright text-xs font-medium transition duration-150 cursor-pointer"
                    >
                      Open in Studio
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Trust & Value Proposition Bar */}
        <section className="border-b border-outline-variant bg-surface-container-lowest">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { icon: "check_circle", color: "text-success", label: "100% Free" },
              { icon: "code", color: "text-secondary", label: "Open Source" },
              { icon: "credit_card_off", color: "text-primary", label: "No Subscription" },
              { icon: "translate", color: "text-secondary", label: "Multilingual AI" },
              { icon: "tune", color: "text-primary", label: "3 Speech Engines" },
              { icon: "database", color: "text-secondary", label: "PostgreSQL Library" },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <span
                  className={`material-symbols-outlined text-base ${item.color}`}
                  aria-hidden="true"
                >
                  {item.icon}
                </span>
                <span className="text-xs font-medium text-on-surface">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Feature Showcase */}
        <section
          id="features"
          className="py-16 lg:py-24 border-b border-outline-variant"
        >
          <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col gap-12">
            <div className="max-w-2xl flex flex-col gap-3">
              <h2 className="font-display text-3xl lg:text-[40px] lg:leading-[48px] tracking-[-0.8px] font-bold text-on-surface text-balance">
                Built for real multilingual conversations.
              </h2>
              <p className="text-base leading-[26px] text-on-surface-variant text-pretty">
                Every control in VoxScribe serves real-world speech:
                code-switching between English and Indian languages, switching
                engines on the fly, and keeping every note searchable.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              <article className="h-full rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      translate
                    </span>
                  </span>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    Hinglish &amp; 8+ Indian Languages
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    Transcribe natural code-switched Hinglish alongside Hindi,
                    Kannada, Tamil, Telugu, Malayalam, Bengali, Marathi,
                    Gujarati, and English.
                  </p>
                </div>
                <div className="pt-3 border-t border-outline-variant flex flex-wrap gap-1.5">
                  {["hi-IN", "kn-IN", "ta-IN", "te-IN"].map((code) => (
                    <span
                      key={code}
                      className="px-2 py-0.5 rounded bg-surface-container-lowest font-mono text-xs text-secondary"
                    >
                      {code}
                    </span>
                  ))}
                </div>
              </article>

              <article className="h-full rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      hub
                    </span>
                  </span>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    Multi-Engine Switching
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    Choose between Gemini AI for contextual multilingual
                    accuracy, Faster-Whisper for local/server inference, or
                    Browser Speech for zero-latency capture.
                  </p>
                </div>
                <div className="pt-3 border-t border-outline-variant font-mono text-xs text-on-surface-variant">
                  Gemini AI · Faster-Whisper · Web Speech
                </div>
              </article>

              <article className="h-full rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      graphic_eq
                    </span>
                  </span>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    Live Audio Visualization
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    Real-time waveform feedback, continue/new-session controls,
                    keyboard shortcuts (Space to toggle mic), and instant
                    duration tracking.
                  </p>
                </div>
                <div className="pt-3 border-t border-outline-variant font-mono text-xs text-on-surface-variant">
                  Space to record · ? for shortcuts
                </div>
              </article>

              <article className="h-full rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      volume_up
                    </span>
                  </span>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    Neural Text-to-Speech
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    Listen back to any live or saved transcription with
                    integrated neural TTS playback and adjustable speed from
                    0.6x to 1.8x.
                  </p>
                </div>
                <div className="pt-3 border-t border-outline-variant font-mono text-xs text-on-surface-variant">
                  0.6x — 1.0x — 1.4x — 1.8x
                </div>
              </article>

              <article className="h-full rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      manage_search
                    </span>
                  </span>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    Searchable PostgreSQL History
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    Filter saved records by content, language, speech engine, or
                    starred status. Open, edit, copy, export, or delete entries
                    cleanly.
                  </p>
                </div>
                <div className="pt-3 border-t border-outline-variant font-mono text-xs text-on-surface-variant">
                  Full CRUD · Auto-save support
                </div>
              </article>

              <article className="h-full rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col justify-between gap-4">
                <div className="flex flex-col gap-3">
                  <span className="w-10 h-10 rounded-lg bg-surface-container-high border border-outline-variant flex items-center justify-center text-success">
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">
                      lock_open
                    </span>
                  </span>
                  <h3 className="font-headline text-lg font-semibold text-on-surface">
                    Free &amp; Open-Source Forever
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    No paywalls, no credit card gates, and no usage tiers. Run
                    it hosted or inspect and self-host the entire stack from
                    GitHub.
                  </p>
                </div>
                <div className="pt-3 border-t border-outline-variant font-mono text-xs text-success">
                  $0 / month · Open Source
                </div>
              </article>
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section
          id="how-it-works"
          className="py-16 lg:py-24 border-b border-outline-variant bg-surface-container-lowest"
        >
          <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col gap-12">
            <div className="max-w-2xl flex flex-col gap-3">
              <h2 className="font-display text-3xl lg:text-[40px] lg:leading-[48px] tracking-[-0.8px] font-bold text-on-surface text-balance">
                From voice to searchable text in three steps.
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              <div className="rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col gap-3">
                <span className="material-symbols-outlined text-3xl text-recording" aria-hidden="true">
                  mic
                </span>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  1. Speak
                </h3>
                <p className="text-sm leading-[22px] text-on-surface-variant">
                  Press Space or click the microphone button to start recording.
                  Watch live audio waveforms confirm your input in real time.
                </p>
              </div>

              <div className="rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col gap-3">
                <span className="material-symbols-outlined text-3xl text-primary" aria-hidden="true">
                  psychology
                </span>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  2. Transcribe
                </h3>
                <p className="text-sm leading-[22px] text-on-surface-variant">
                  Pick Hinglish or any of 8+ Indian languages and choose Gemini
                  AI, Faster-Whisper, or Browser Speech Recognition.
                </p>
              </div>

              <div className="rounded-xl bg-surface-container-low border border-outline-variant p-6 flex flex-col gap-3">
                <span className="material-symbols-outlined text-3xl text-secondary" aria-hidden="true">
                  library_add_check
                </span>
                <h3 className="font-headline text-lg font-semibold text-on-surface">
                  3. Use
                </h3>
                <p className="text-sm leading-[22px] text-on-surface-variant">
                  Edit your transcript inline, listen back with adjustable-speed
                  Neural TTS, copy to clipboard, or save to PostgreSQL history.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Technology Architecture */}
        <section
          id="technology"
          className="py-16 lg:py-24 border-b border-outline-variant"
        >
          <div className="max-w-7xl mx-auto px-4 lg:px-8 flex flex-col gap-10">
            <div className="max-w-2xl flex flex-col gap-3">
              <h2 className="font-display text-3xl lg:text-[40px] lg:leading-[48px] tracking-[-0.8px] font-bold text-on-surface text-balance">
                Modern speech stack, transparently engineered.
              </h2>
              <p className="text-base leading-[26px] text-on-surface-variant">
                VoxScribe combines cloud multimodal models, local-ready Whisper
                inference, browser-native APIs, and relational persistence.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {[
                {
                  tag: "AI ENGINE 01",
                  tagColor: "text-primary",
                  title: "Gemini AI",
                  desc: "Multimodal audio understanding tuned for natural Hinglish code-switching and regional Indian accents.",
                },
                {
                  tag: "AI ENGINE 02",
                  tagColor: "text-secondary",
                  title: "Faster-Whisper",
                  desc: "CTranslate2-accelerated Whisper speech recognition for fast, high-accuracy multilingual transcription.",
                },
                {
                  tag: "AI ENGINE 03",
                  tagColor: "text-primary",
                  title: "Browser Speech Recognition",
                  desc: "Zero-setup Web Speech API fallback for instant streaming words directly inside supported browsers.",
                },
                {
                  tag: "VOICE OUTPUT",
                  tagColor: "text-secondary",
                  title: "Neural Text-to-Speech",
                  desc: "Natural speech synthesis with play/stop controls and variable speed playback for reviewing notes.",
                },
                {
                  tag: "PERSISTENCE",
                  tagColor: "text-success",
                  title: "PostgreSQL",
                  desc: "Structured relational storage powering fast search, language filtering, starring, and CRUD edits.",
                },
                {
                  tag: "ARCHITECTURE",
                  tagColor: "text-on-surface-variant",
                  title: "Full-Stack Web Platform",
                  desc: "Clean API contracts, real-time AudioWorklet capture pipelines, and responsive controls.",
                },
              ].map((item) => (
                <div
                  key={item.title}
                  className="rounded-xl bg-surface-container-low border border-outline-variant p-5 flex flex-col gap-2"
                >
                  <span className={`font-mono text-xs ${item.tagColor}`}>
                    {item.tag}
                  </span>
                  <h3 className="font-headline text-base font-semibold text-on-surface">
                    {item.title}
                  </h3>
                  <p className="text-sm leading-[22px] text-on-surface-variant">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Open Source CTA Section */}
        <section id="open-source" className="py-16 lg:py-24 bg-surface-container-lowest">
          <div className="max-w-5xl mx-auto px-4 lg:px-8">
            <div className="rounded-2xl bg-surface-container border border-outline-variant p-8 lg:p-12 flex flex-col items-start gap-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface-container-high border border-outline-variant text-secondary text-xs font-medium">
                100% Free &amp; Open Source
              </span>
              <h2 className="font-display text-3xl lg:text-[40px] lg:leading-[48px] tracking-[-0.8px] font-bold text-on-surface text-balance">
                Powerful AI. Open to Everyone.
              </h2>
              <p className="text-base leading-[26px] text-on-surface-variant max-w-prose text-pretty">
                VoxScribe is built in the open so developers, researchers, and
                everyday speakers can use, inspect, and extend multilingual
                voice AI without barriers. Explore the repository, star the
                project, or open a pull request.
              </p>
              <div className="flex flex-wrap items-center gap-4">
                <a
                  href="https://github.com/Karthik-Kathari/voxscribe-realtime-stt"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-primary-container text-on-primary-container hover:bg-inverse-primary text-sm font-medium transition duration-150"
                >
                  <span className="material-symbols-outlined text-base" aria-hidden="true">
                    code
                  </span>
                  <span>Explore Source Code on GitHub</span>
                </a>
                <button
                  type="button"
                  onClick={onNavigateStudio}
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-surface-container-high text-on-surface border border-outline-variant hover:bg-surface-bright text-sm font-medium transition duration-150 cursor-pointer"
                >
                  <span>Open Transcription Studio</span>
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Multi-Column Footer */}
      <footer className="border-t border-outline-variant bg-surface-container-lowest">
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-8">
          <div className="lg:col-span-4 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="font-headline text-lg font-semibold text-on-surface">
                VoxScribe
              </span>
              <span className="px-2 py-0.5 rounded-full bg-surface-container-high border border-outline-variant text-xs font-medium text-secondary">
                Open Source
              </span>
            </div>
            <p className="text-sm text-on-surface-variant max-w-sm">
              Your voice. Every language. Instantly understood. Free multilingual
              AI speech-to-text built for Hinglish and Indian languages.
            </p>
            <div className="pt-2 flex flex-col gap-1">
              <p className="text-xs font-medium text-on-surface">
                Built with passion by Karthik Kathari
              </p>
              <p className="text-xs text-outline">
                Full Stack &amp; AI Engineer · Independent Open-Source Project
              </p>
            </div>
          </div>

          <div className="lg:col-span-2 flex flex-col gap-2.5">
            <h3 className="text-xs font-medium text-on-surface">Product</h3>
            <button
              type="button"
              onClick={onNavigateStudio}
              className="text-left text-sm text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              Transcription Studio
            </button>
            <button
              type="button"
              onClick={onNavigateHistory}
              className="text-left text-sm text-on-surface-variant hover:text-on-surface cursor-pointer"
            >
              History Library
            </button>
            <a
              href="https://voxscribe-realtime-stt.onrender.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-on-surface-variant hover:text-on-surface"
            >
              Live Application
            </a>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-2.5">
            <h3 className="text-xs font-medium text-on-surface">Technology</h3>
            <a
              href="#technology"
              className="text-sm text-on-surface-variant hover:text-on-surface"
            >
              Gemini AI &amp; Faster-Whisper
            </a>
            <a
              href="#technology"
              className="text-sm text-on-surface-variant hover:text-on-surface"
            >
              Browser Speech Recognition
            </a>
            <a
              href="#technology"
              className="text-sm text-on-surface-variant hover:text-on-surface"
            >
              Neural TTS &amp; PostgreSQL
            </a>
          </div>

          <div className="lg:col-span-3 flex flex-col gap-2.5">
            <h3 className="text-xs font-medium text-on-surface">
              Creator &amp; Source
            </h3>
            <a
              href="https://github.com/Karthik-Kathari/voxscribe-realtime-stt"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-on-surface-variant hover:text-secondary"
            >
              GitHub Repository
            </a>
            <a
              href="https://github.com/Karthik-Kathari"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-on-surface-variant hover:text-secondary"
            >
              GitHub Profile (@Karthik-Kathari)
            </a>
            <a
              href="https://linkedin.com/in/karthikkathari"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-on-surface-variant hover:text-secondary"
            >
              LinkedIn (Karthik Kathari)
            </a>
            <a
              href="mailto:karthikkathari74@gmail.com"
              className="text-sm text-on-surface-variant hover:text-secondary"
            >
              karthikkathari74@gmail.com
            </a>
          </div>
        </div>
        <div className="border-t border-outline-variant">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <span className="text-xs text-outline">
              An independent open-source AI project by Karthik Kathari — Full
              Stack &amp; AI Engineer.
            </span>
            <span className="font-mono text-xs text-outline">
              100% Free &amp; Open Source
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}

