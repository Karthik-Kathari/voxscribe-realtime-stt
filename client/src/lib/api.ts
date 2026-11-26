import type {
  EngineStatus,
  TranscriptSegment,
  Transcription,
  TranscriptionListResponse,
  TranscriptionStats,
} from "../types";

export interface ListTranscriptionsParams {
  q?: string;
  language?: string;
  engine?: string;
  favorite?: boolean;
  sort?: "newest" | "oldest" | "longest";
  limit?: number;
  offset?: number;
}

export interface CreateTranscriptionPayload {
  title?: string;
  content: string;
  language: string;
  detectedLanguages?: string[];
  engine: string;
  durationSeconds: number;
  segments?: TranscriptSegment[];
  notes?: string;
  isFavorite?: boolean;
}

export interface UpdateTranscriptionPayload {
  title?: string;
  content?: string;
  language?: string;
  detectedLanguages?: string[];
  notes?: string;
  isFavorite?: boolean;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const data = await res.json();
      if (data?.error) message = data.error;
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export async function fetchHealth(): Promise<EngineStatus> {
  const res = await fetch("/api/health");
  return handleResponse<EngineStatus>(res);
}

export async function fetchStats(): Promise<TranscriptionStats> {
  const res = await fetch("/api/transcriptions/stats");
  return handleResponse<TranscriptionStats>(res);
}

export async function fetchTranscriptions(
  params: ListTranscriptionsParams = {}
): Promise<TranscriptionListResponse> {
  const sp = new URLSearchParams();
  if (params.q) sp.set("q", params.q);
  if (params.language && params.language !== "all") {
    sp.set("language", params.language);
  }
  if (params.engine && params.engine !== "all") sp.set("engine", params.engine);
  if (params.favorite) sp.set("favorite", "true");
  if (params.sort) sp.set("sort", params.sort);
  if (params.limit) sp.set("limit", String(params.limit));
  if (params.offset) sp.set("offset", String(params.offset));

  const qs = sp.toString();
  const res = await fetch(`/api/transcriptions${qs ? `?${qs}` : ""}`);
  return handleResponse<TranscriptionListResponse>(res);
}

export async function createTranscription(
  payload: CreateTranscriptionPayload
): Promise<Transcription> {
  const res = await fetch("/api/transcriptions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Transcription>(res);
}

export async function updateTranscription(
  id: string,
  payload: UpdateTranscriptionPayload
): Promise<Transcription> {
  const res = await fetch(`/api/transcriptions/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return handleResponse<Transcription>(res);
}

export async function deleteTranscription(
  id: string
): Promise<{ deleted: boolean; id: string }> {
  const res = await fetch(`/api/transcriptions/${id}`, {
    method: "DELETE",
  });
  return handleResponse<{ deleted: boolean; id: string }>(res);
}

export async function bulkDeleteTranscriptions(
  ids: string[]
): Promise<{ deletedCount: number; ids: string[] }> {
  const res = await fetch("/api/transcriptions/bulk-delete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  return handleResponse<{ deletedCount: number; ids: string[] }>(res);
}

