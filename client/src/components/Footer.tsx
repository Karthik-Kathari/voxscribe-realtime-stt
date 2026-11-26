export function StudioFooter() {
  return (
    <footer className="border-t border-outline-variant bg-surface-container-lowest">
      <div className="max-w-7xl mx-auto px-4 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-3">
        <span className="text-xs text-outline">
          Built with passion by{" "}
          <strong className="text-on-surface font-medium">Karthik Kathari</strong>{" "}
          — Full Stack &amp; AI Engineer · 100% Free &amp; Open Source
        </span>
        <div className="flex items-center gap-4 text-xs font-medium text-on-surface-variant">
          <a
            href="https://github.com/Karthik-Kathari/voxscribe-realtime-stt"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-secondary transition"
          >
            GitHub Repo
          </a>
          <a
            href="https://linkedin.com/in/karthikkathari"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-secondary transition"
          >
            LinkedIn
          </a>
          <a
            href="mailto:karthikkathari74@gmail.com"
            className="hover:text-secondary transition"
          >
            Email
          </a>
        </div>
      </div>
    </footer>
  );
}

