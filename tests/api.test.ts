import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import http from "node:http";
import {
  countWords,
  deriveTitle,
  detectScripts,
} from "../server/src/routes/transcriptions.js";
import { createApp } from "../server/src/index.js";
import { ensureSchema, pool } from "../server/src/db/index.js";
import { config } from "../server/src/config.js";

describe("Transcription helper utilities", () => {
  it("counts multilingual words accurately", () => {
    assert.equal(countWords("Hello team aaj standup hai"), 5);
    assert.equal(countWords("   नमस्ते   world  "), 2);
    assert.equal(countWords("   "), 0);
  });

  it("derives concise titles from long content", () => {
    assert.equal(
      deriveTitle("One two three four five six seven eight nine"),
      "One two three four five six seven..."
    );
    assert.equal(deriveTitle("Short Hindi test"), "Short Hindi test");
  });

  it("detects Hindi (Devanagari), Kannada, Tamil, and English scripts", () => {
    assert.deepEqual(detectScripts("नमस्ते team, कैसे हो?"), [
      "Hindi / Devanagari",
      "English",
    ]);
    assert.deepEqual(detectScripts("Pure English sentence"), ["English"]);
    assert.deepEqual(detectScripts("ನಮಸ್ಕಾರ ಬೆಂಗಳೂರು"), ["Kannada"]);
    assert.deepEqual(detectScripts("வணக்கம் சென்னை"), ["Tamil"]);
  });
});

describe("CRUD API integration against Neon PostgreSQL", () => {
  let server: http.Server;
  let baseUrl = "";
  let createdId = "";

  before(async () => {
    if (!config.databaseUrl) {
      throw new Error("DATABASE_URL must be configured to run API integration tests");
    }
    await ensureSchema();
    const app = createApp();
    server = http.createServer(app);
    await new Promise<void>((resolve) => {
      server.listen(0, "127.0.0.1", () => resolve());
    });
    const addr = server.address();
    if (!addr || typeof addr === "string") {
      throw new Error("Failed to bind test server");
    }
    baseUrl = `http://127.0.0.1:${addr.port}`;
  });

  after(async () => {
    if (createdId) {
      await fetch(`${baseUrl}/api/transcriptions/${createdId}`, {
        method: "DELETE",
      }).catch(() => {});
    }
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    await pool.end();
  });

  it("GET /api/health reports databaseConnected=true", async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      status: string;
      databaseConnected: boolean;
    };
    assert.equal(body.status, "ok");
    assert.equal(body.databaseConnected, true);
  });

  it("performs full Create -> Read -> Update -> Delete lifecycle", async () => {
    // CREATE
    const createRes = await fetch(`${baseUrl}/api/transcriptions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: "Hello team, आज का demo 5 PM को है",
        language: "hi-en",
        engine: "gemini-live-3.1",
        durationSeconds: 14,
        notes: "Integration test record",
      }),
    });
    assert.equal(createRes.status, 201);
    const created = (await createRes.json()) as {
      id: string;
      title: string;
      wordCount: number;
      detectedLanguages: string[];
    };
    assert.ok(created.id);
    createdId = created.id;
    assert.ok(created.detectedLanguages.includes("Hindi / Devanagari"));
    assert.ok(created.detectedLanguages.includes("English"));

    // READ (list + search)
    const listRes = await fetch(
      `${baseUrl}/api/transcriptions?q=${encodeURIComponent("demo 5 PM")}`
    );
    assert.equal(listRes.status, 200);
    const listBody = (await listRes.json()) as {
      items: Array<{ id: string }>;
      total: number;
    };
    assert.ok(listBody.items.some((i) => i.id === createdId));

    // UPDATE
    const patchRes = await fetch(`${baseUrl}/api/transcriptions/${createdId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: "Updated Standup Demo",
        isFavorite: true,
        notes: "Updated via integration test",
      }),
    });
    assert.equal(patchRes.status, 200);
    const updated = (await patchRes.json()) as {
      title: string;
      isFavorite: boolean;
    };
    assert.equal(updated.title, "Updated Standup Demo");
    assert.equal(updated.isFavorite, true);

    // STATS
    const statsRes = await fetch(`${baseUrl}/api/transcriptions/stats`);
    assert.equal(statsRes.status, 200);
    const stats = (await statsRes.json()) as { totalCount: number };
    assert.ok(stats.totalCount >= 1);

    // DELETE
    const delRes = await fetch(`${baseUrl}/api/transcriptions/${createdId}`, {
      method: "DELETE",
    });
    assert.equal(delRes.status, 200);
    createdId = "";

    // Verify 404 after delete
    const getDeleted = await fetch(
      `${baseUrl}/api/transcriptions/${created.id}`
    );
    assert.equal(getDeleted.status, 404);
  });

  it("POST /api/tts synthesizes natural MP3 audio for Hinglish and Kannada text", async () => {
    const res = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "Hello team, aaj ka standup 5 minute mein start karte hain.",
        language: "hi-en",
      }),
    });
    assert.equal(res.status, 200);
    assert.equal(res.headers.get("content-type"), "audio/mpeg");
    assert.equal(res.headers.get("x-tts-voice"), "hi-IN-SwaraNeural");
    const buf = await res.arrayBuffer();
    assert.ok(buf.byteLength > 5000);

    const knRes = await fetch(`${baseUrl}/api/tts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text: "ನಮಸ್ಕಾರ ಬೆಂಗಳೂರು",
        language: "hi-en",
      }),
    });
    assert.equal(knRes.status, 200);
    assert.equal(knRes.headers.get("x-tts-voice"), "kn-IN-SapnaNeural");
    const knBuf = await knRes.arrayBuffer();
    assert.ok(knBuf.byteLength > 3000);
  });
});

