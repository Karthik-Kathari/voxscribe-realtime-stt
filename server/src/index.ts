import cors from "cors";
import express from "express";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import helmet from "helmet";
import { WebSocketServer } from "ws";
import { config } from "./config.js";
import { ensureSchema, pool } from "./db/index.js";
import transcriptionsRouter from "./routes/transcriptions.js";
import ttsRouter from "./routes/tts.js";
import { handleTranscribeSocket } from "./ws/transcribe.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: false,
    })
  );
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", async (_req, res) => {
    let databaseConnected = false;
    try {
      if (config.databaseUrl) {
        await pool.query("SELECT 1");
        databaseConnected = true;
      }
    } catch {
      databaseConnected = false;
    }

    res.json({
      status: "ok",
      geminiConfigured: Boolean(config.geminiApiKey),
      geminiModel: config.geminiLiveModel,
      whisperConfigured: Boolean(config.whisperWsUrl),
      databaseConnected,
    });
  });

  app.use("/api/transcriptions", transcriptionsRouter);
  app.use("/api/tts", ttsRouter);

  // Serve built React frontend when present (e.g. production / Render / Docker)
  const clientDistDir = path.resolve(__dirname, "../../dist/client");
  const fallbackClientDistDir = path.resolve(__dirname, "../client");
  const staticDir = fs.existsSync(clientDistDir)
    ? clientDistDir
    : fs.existsSync(fallbackClientDistDir)
      ? fallbackClientDistDir
      : null;

  if (staticDir) {
    app.use(express.static(staticDir));
    app.get("*", (req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/ws")) {
        next();
        return;
      }
      res.sendFile(path.join(staticDir, "index.html"));
    });
  }

  return app;
}

async function startServer() {
  await ensureSchema();

  const app = createApp();
  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (request, socket, head) => {
    const reqUrl = new URL(
      request.url || "/",
      `http://${request.headers.host || "localhost"}`
    );

    if (reqUrl.pathname !== "/ws/transcribe") {
      socket.destroy();
      return;
    }

    const engine = reqUrl.searchParams.get("engine") || "gemini";
    const language = reqUrl.searchParams.get("language") || "hi-en";

    wss.handleUpgrade(request, socket, head, (ws) => {
      void handleTranscribeSocket(ws, engine, language);
    });
  });

  server.listen(config.port, () => {
    console.log(
      `[server] VoxScribe listening on http://localhost:${config.port} (${config.nodeEnv})`
    );
  });
}

// Start HTTP/WS server only when executed directly (allows importing createApp in tests)
const isEntryPoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(__filename);

if (isEntryPoint) {
  startServer().catch((err) => {
    console.error("[server] Fatal startup error:", err);
    process.exit(1);
  });
}

