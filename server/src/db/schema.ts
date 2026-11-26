import {
  pgTable,
  uuid,
  varchar,
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
} from "drizzle-orm/pg-core";

export interface TranscriptSegment {
  id: string;
  text: string;
  language?: string;
  timestamp: string;
}

export const transcriptions = pgTable(
  "transcriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 200 }).notNull(),
    content: text("content").notNull(),
    language: varchar("language", { length: 64 }).notNull().default("hi-en"),
    detectedLanguages: jsonb("detected_languages")
      .$type<string[]>()
      .notNull()
      .default([]),
    engine: varchar("engine", { length: 64 })
      .notNull()
      .default("gemini-live-3.1"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    wordCount: integer("word_count").notNull().default(0),
    segments: jsonb("segments")
      .$type<TranscriptSegment[]>()
      .notNull()
      .default([]),
    notes: text("notes").notNull().default(""),
    isFavorite: boolean("is_favorite").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_transcriptions_created_at").on(table.createdAt),
    index("idx_transcriptions_language").on(table.language),
    index("idx_transcriptions_engine").on(table.engine),
  ]
);

export type Transcription = typeof transcriptions.$inferSelect;
export type NewTranscription = typeof transcriptions.$inferInsert;

