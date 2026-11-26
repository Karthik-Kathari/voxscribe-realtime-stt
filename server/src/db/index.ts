import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { config } from "../config.js";
import * as schema from "./schema.js";

if (!config.databaseUrl) {
  console.warn(
    "[db] DATABASE_URL is not set. Database queries will fail until configured."
  );
}

export const pool = new Pool({
  connectionString: config.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
  ssl: config.databaseUrl.includes("sslmode=require")
    ? { rejectUnauthorized: false }
    : undefined,
});

pool.on("error", (err) => {
  console.error("[db] Unexpected idle client error:", err.message);
});

export const db = drizzle(pool, { schema });

/**
 * Ensures the transcriptions table and indexes exist on startup.
 * Safe and idempotent for cloud deployments (Render / Neon).
 */
export async function ensureSchema(): Promise<void> {
  if (!config.databaseUrl) return;
  await pool.query(`
    CREATE EXTENSION IF NOT EXISTS pgcrypto;

    CREATE TABLE IF NOT EXISTS transcriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(200) NOT NULL,
      content TEXT NOT NULL,
      language VARCHAR(64) NOT NULL DEFAULT 'hi-en',
      detected_languages JSONB NOT NULL DEFAULT '[]'::jsonb,
      engine VARCHAR(64) NOT NULL DEFAULT 'gemini-live-3.1',
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      word_count INTEGER NOT NULL DEFAULT 0,
      segments JSONB NOT NULL DEFAULT '[]'::jsonb,
      notes TEXT NOT NULL DEFAULT '',
      is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_transcriptions_created_at ON transcriptions (created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_transcriptions_language ON transcriptions (language);
    CREATE INDEX IF NOT EXISTS idx_transcriptions_engine ON transcriptions (engine);
  `);
}

