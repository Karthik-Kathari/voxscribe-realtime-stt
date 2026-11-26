# VoxScribe AI — Real-Time Multilingual Speech-to-Text

A full-stack **Real-Time Multilingual Speech-to-Text (STT)** web application built with **React + TypeScript + Node.js (Express & WebSockets) + PostgreSQL (Neon)**, supporting live Hindi + English (Hinglish) and multi-language code-switching transcription, full **CRUD** history management, and **Text-to-Speech (TTS)** playback.

---

## Key Features

- **Real-Time Multilingual Speech-to-Text**
  - Captures microphone audio via a browser `AudioWorklet` (`16kHz`, 16-bit mono PCM) with live waveform visualization.
  - Supports **Hindi + English (Hinglish)** code-switching as well as English, Hindi, Tamil, Telugu, Kannada, and Bengali.
- **Pluggable Dual-Engine STT Architecture**
  1. **Gemini Live 3.1 (`gemini-3.1-flash-live-preview`)** — Server-side WebSocket proxy (`@google/genai`) keeping `GEMINI_API_KEY` secure while streaming real-time audio and returning live input transcriptions.
  2. **Self-Deployed Open-Source Faster-Whisper (`stt-service/`)** — Optional Python FastAPI + `faster-whisper` (`int8`) Docker microservice for 100% offline/open-source speech recognition.
  3. **Browser Web Speech API** — Zero-config instant browser fallback when no external key or Docker container is active.
- **PostgreSQL Transcription History Dashboard (Full CRUD)**
  - **Create**: Auto-save live sessions or create manual entries.
  - **Read**: Search across title, transcript text, and notes; filter by language, engine, or starred status; sort by newest, oldest, or word count.
  - **Update**: Edit transcript text, title, language tag, notes, and favorite status (word count and script detection recalculate automatically).
  - **Delete**: Single entry delete with inline confirmation, plus multi-select bulk delete.
- **Open-Source Text-to-Speech (TTS) & Export**
  - Read saved transcriptions aloud directly from the dashboard or modal, copy to clipboard, or export as `.txt` / `.json`.

---

## Architecture

```
Browser (React + Vite + Tailwind + AudioWorklet 16kHz PCM)
   ├── REST (/api/transcriptions, /api/health, /api/transcriptions/stats)
   │      └── Express + Drizzle ORM ──▶ Neon PostgreSQL
   └── WebSocket (/ws/transcribe?engine=gemini|whisper&language=hi-en)
          ├── Gemini Live 3.1 API (gemini-3.1-flash-live-preview)
          └── Optional Self-Hosted Faster-Whisper (stt-service FastAPI)
```

---

## Quick Start (Local Development)

### 1. Prerequisites
- Node.js 20+
- A PostgreSQL database (e.g., [Neon](https://neon.tech) free tier)
- Optional: Free Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey)

### 2. Configure Environment
```bash
cp .env.example .env
```
Fill in `DATABASE_URL` and `GEMINI_API_KEY` in `.env`.

### 3. Install & Run
```bash
npm install
npm run dev
```
- Frontend: `http://localhost:5173`
- Backend API & WebSocket: `http://localhost:5000`
- Database schema (`transcriptions` table & indexes) initializes automatically on startup.

---

## Self-Hosted Open-Source STT (Docker Compose)

To run the full stack with the self-deployed open-source **Faster-Whisper** microservice locally:

```bash
docker compose up --build
```
This launches:
- `app` on port `5000` (React frontend + Node.js API/WS server)
- `whisper-stt` on port `8000` (Python FastAPI + `faster-whisper` `small` int8 model)

---

## Cloud Deployment (Render Free Tier + Neon PostgreSQL)

1. Push this repository to GitHub.
2. In [Render](https://render.com), click **New +** -> **Blueprint** (or **Web Service**) and connect your GitHub repo (`render.yaml` is included).
3. Add environment variables in Render:
   - `DATABASE_URL`: Your Neon PostgreSQL pooled connection string
   - `GEMINI_API_KEY`: Your Google AI Studio free API key
4. Deploy! Render builds the client and server (`npm ci && npm run build`) and serves everything from a single HTTPS/WSS URL.

---

## API Endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/health` | Check DB, Gemini Live, and Whisper status |
| `GET` | `/api/transcriptions` | List/search/filter/sort transcriptions |
| `GET` | `/api/transcriptions/stats` | Aggregated counts, words, and duration |
| `GET` | `/api/transcriptions/:id` | Fetch single transcription |
| `POST` | `/api/transcriptions` | Create transcription |
| `PATCH` | `/api/transcriptions/:id` | Update transcription |
| `DELETE` | `/api/transcriptions/:id` | Delete transcription |
| `POST` | `/api/transcriptions/bulk-delete` | Delete multiple transcriptions |
| `WS` | `/ws/transcribe` | Real-time 16kHz PCM audio streaming |

---

## Running Tests

```bash
npm run typecheck
npm run build
npm test
```

