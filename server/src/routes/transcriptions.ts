import { Router, type Request, type Response } from "express";
import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db/index.js";
import { transcriptions, type TranscriptSegment } from "../db/schema.js";

const router = Router();

const segmentSchema = z.object({
  id: z.string().min(1),
  text: z.string(),
  language: z.string().optional(),
  timestamp: z.string(),
});

const createTranscriptionSchema = z.object({
  title: z.string().trim().max(200).optional(),
  content: z.string().trim().min(1, "Transcription content cannot be empty"),
  language: z.string().trim().min(1).max(64).default("hi-en"),
  detectedLanguages: z.array(z.string()).optional(),
  engine: z.string().trim().min(1).max(64).default("gemini-live-3.1"),
  durationSeconds: z.number().int().min(0).default(0),
  segments: z.array(segmentSchema).default([]),
  notes: z.string().max(5000).default(""),
  isFavorite: z.boolean().default(false),
});

const updateTranscriptionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z
    .string()
    .trim()
    .min(1, "Transcription content cannot be empty")
    .optional(),
  language: z.string().trim().min(1).max(64).optional(),
  detectedLanguages: z.array(z.string()).optional(),
  durationSeconds: z.number().int().min(0).optional(),
  segments: z.array(segmentSchema).optional(),
  notes: z.string().max(5000).optional(),
  isFavorite: z.boolean().optional(),
});

const bulkDeleteSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
});

const uuidSchema = z.string().uuid();

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

export function deriveTitle(content: string): string {
  const cleaned = content.replace(/\s+/g, " ").trim();
  if (!cleaned) return "Untitled Transcription";
  const words = cleaned.split(" ").slice(0, 7).join(" ");
  return words.length < cleaned.length ? `${words}...` : words;
}

export function detectScripts(text: string): string[] {
  const detected: string[] = [];
  if (/[\u0900-\u097F]/.test(text)) detected.push("Hindi / Devanagari");
  if (/[A-Za-z]/.test(text)) detected.push("English");
  if (/[\u0C80-\u0CFF]/.test(text)) detected.push("Kannada");
  if (/[\u0B80-\u0BFF]/.test(text)) detected.push("Tamil");
  if (/[\u0C00-\u0C7F]/.test(text)) detected.push("Telugu");
  if (/[\u0D00-\u0D7F]/.test(text)) detected.push("Malayalam");
  if (/[\u0A80-\u0AFF]/.test(text)) detected.push("Gujarati");
  if (/[\u0980-\u09FF]/.test(text)) detected.push("Bengali");
  if (/[\u0A00-\u0A7F]/.test(text)) detected.push("Punjabi");
  return detected.length > 0 ? detected : ["Multilingual"];
}

// GET /api/transcriptions/stats
router.get("/stats", async (_req: Request, res: Response) => {
  try {
    const [totals] = await db
      .select({
        totalCount: sql<number>`count(*)::int`,
        totalWords: sql<number>`coalesce(sum(${transcriptions.wordCount}), 0)::int`,
        totalDurationSeconds: sql<number>`coalesce(sum(${transcriptions.durationSeconds}), 0)::int`,
        favoriteCount: sql<number>`count(*) filter (where ${transcriptions.isFavorite} = true)::int`,
      })
      .from(transcriptions);

    const byLanguage = await db
      .select({
        language: transcriptions.language,
        count: sql<number>`count(*)::int`,
      })
      .from(transcriptions)
      .groupBy(transcriptions.language);

    const byEngine = await db
      .select({
        engine: transcriptions.engine,
        count: sql<number>`count(*)::int`,
      })
      .from(transcriptions)
      .groupBy(transcriptions.engine);

    res.json({
      totalCount: totals?.totalCount ?? 0,
      totalWords: totals?.totalWords ?? 0,
      totalDurationSeconds: totals?.totalDurationSeconds ?? 0,
      favoriteCount: totals?.favoriteCount ?? 0,
      byLanguage,
      byEngine,
    });
  } catch (err) {
    console.error("[api] GET /stats error:", err);
    res.status(500).json({ error: "Failed to fetch transcription statistics" });
  }
});

// GET /api/transcriptions
router.get("/", async (req: Request, res: Response) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
    const language =
      typeof req.query.language === "string" ? req.query.language.trim() : "";
    const engine =
      typeof req.query.engine === "string" ? req.query.engine.trim() : "";
    const favorite = req.query.favorite;
    const sort = typeof req.query.sort === "string" ? req.query.sort : "newest";
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
    const offset = Math.max(Number(req.query.offset) || 0, 0);

    const conditions = [];
    if (q) {
      const pattern = `%${q}%`;
      conditions.push(
        or(
          ilike(transcriptions.title, pattern),
          ilike(transcriptions.content, pattern),
          ilike(transcriptions.notes, pattern)
        )
      );
    }
    if (language && language !== "all") {
      conditions.push(eq(transcriptions.language, language));
    }
    if (engine && engine !== "all") {
      conditions.push(eq(transcriptions.engine, engine));
    }
    if (favorite === "true") {
      conditions.push(eq(transcriptions.isFavorite, true));
    }

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const orderBy =
      sort === "oldest"
        ? asc(transcriptions.createdAt)
        : sort === "longest"
          ? desc(transcriptions.wordCount)
          : desc(transcriptions.createdAt);

    const [items, countRows] = await Promise.all([
      db
        .select()
        .from(transcriptions)
        .where(whereClause)
        .orderBy(orderBy)
        .limit(limit)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(transcriptions)
        .where(whereClause),
    ]);

    res.json({
      items,
      total: countRows[0]?.count ?? 0,
      limit,
      offset,
    });
  } catch (err) {
    console.error("[api] GET /transcriptions error:", err);
    res.status(500).json({ error: "Failed to fetch transcriptions" });
  }
});

// GET /api/transcriptions/:id
router.get("/:id", async (req: Request, res: Response) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid transcription ID format" });
    return;
  }

  try {
    const [row] = await db
      .select()
      .from(transcriptions)
      .where(eq(transcriptions.id, parsedId.data))
      .limit(1);

    if (!row) {
      res.status(404).json({ error: "Transcription not found" });
      return;
    }
    res.json(row);
  } catch (err) {
    console.error("[api] GET /transcriptions/:id error:", err);
    res.status(500).json({ error: "Failed to fetch transcription" });
  }
});

// POST /api/transcriptions
router.post("/", async (req: Request, res: Response) => {
  const parsed = createTranscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;
  const title = data.title?.trim() || deriveTitle(data.content);
  const wordCount = countWords(data.content);
  const detectedLanguages =
    data.detectedLanguages && data.detectedLanguages.length > 0
      ? data.detectedLanguages
      : detectScripts(data.content);

  try {
    const [created] = await db
      .insert(transcriptions)
      .values({
        title,
        content: data.content,
        language: data.language,
        detectedLanguages,
        engine: data.engine,
        durationSeconds: data.durationSeconds,
        wordCount,
        segments: data.segments as TranscriptSegment[],
        notes: data.notes,
        isFavorite: data.isFavorite,
      })
      .returning();

    res.status(201).json(created);
  } catch (err) {
    console.error("[api] POST /transcriptions error:", err);
    res.status(500).json({ error: "Failed to save transcription" });
  }
});

// PATCH /api/transcriptions/:id
router.patch("/:id", async (req: Request, res: Response) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid transcription ID format" });
    return;
  }

  const parsed = updateTranscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;
  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: "No update fields provided" });
    return;
  }

  const updates: Record<string, unknown> = {
    updatedAt: new Date(),
  };

  if (data.title !== undefined) updates.title = data.title;
  if (data.content !== undefined) {
    updates.content = data.content;
    updates.wordCount = countWords(data.content);
    if (data.detectedLanguages === undefined) {
      updates.detectedLanguages = detectScripts(data.content);
    }
  }
  if (data.language !== undefined) updates.language = data.language;
  if (data.detectedLanguages !== undefined) {
    updates.detectedLanguages = data.detectedLanguages;
  }
  if (data.durationSeconds !== undefined) {
    updates.durationSeconds = data.durationSeconds;
  }
  if (data.segments !== undefined) updates.segments = data.segments;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isFavorite !== undefined) updates.isFavorite = data.isFavorite;

  try {
    const [updated] = await db
      .update(transcriptions)
      .set(updates)
      .where(eq(transcriptions.id, parsedId.data))
      .returning();

    if (!updated) {
      res.status(404).json({ error: "Transcription not found" });
      return;
    }

    res.json(updated);
  } catch (err) {
    console.error("[api] PATCH /transcriptions/:id error:", err);
    res.status(500).json({ error: "Failed to update transcription" });
  }
});

// DELETE /api/transcriptions/:id
router.delete("/:id", async (req: Request, res: Response) => {
  const parsedId = uuidSchema.safeParse(req.params.id);
  if (!parsedId.success) {
    res.status(400).json({ error: "Invalid transcription ID format" });
    return;
  }

  try {
    const [deleted] = await db
      .delete(transcriptions)
      .where(eq(transcriptions.id, parsedId.data))
      .returning({ id: transcriptions.id });

    if (!deleted) {
      res.status(404).json({ error: "Transcription not found" });
      return;
    }

    res.json({ deleted: true, id: deleted.id });
  } catch (err) {
    console.error("[api] DELETE /transcriptions/:id error:", err);
    res.status(500).json({ error: "Failed to delete transcription" });
  }
});

// POST /api/transcriptions/bulk-delete
router.post("/bulk-delete", async (req: Request, res: Response) => {
  const parsed = bulkDeleteSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "Validation error",
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  try {
    const deleted = await db
      .delete(transcriptions)
      .where(inArray(transcriptions.id, parsed.data.ids))
      .returning({ id: transcriptions.id });

    res.json({
      deletedCount: deleted.length,
      ids: deleted.map((d) => d.id),
    });
  } catch (err) {
    console.error("[api] POST /transcriptions/bulk-delete error:", err);
    res.status(500).json({ error: "Failed to delete transcriptions" });
  }
});

export default router;

