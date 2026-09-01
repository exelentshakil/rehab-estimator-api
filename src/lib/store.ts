import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { JobRecord } from "./types";

/**
 * Job persistence.
 *
 * Supabase/Postgres when configured (required on serverless — each request may
 * land on a different instance), with an in-process map as a local-dev
 * fallback so `npm run dev` works with no database at all.
 */

const TABLE = "rehab_jobs";

let client: SupabaseClient | null = null;
let checked = false;

function supabase(): SupabaseClient | null {
  if (checked) return client;
  checked = true;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (url && key) {
    client = createClient(url, key, { auth: { persistSession: false } });
  }
  return client;
}

const memory = new Map<string, JobRecord>();

export function storageBackend(): "supabase" | "memory" {
  return supabase() ? "supabase" : "memory";
}

export function newJobId(): string {
  const t = Date.now().toString(36);
  const r = Math.random().toString(36).slice(2, 10);
  return `job_${t}${r}`;
}

export async function createJob(job: JobRecord): Promise<JobRecord> {
  const db = supabase();
  if (!db) {
    memory.set(job.id, job);
    return job;
  }
  const { error } = await db.from(TABLE).insert({
    id: job.id,
    status: job.status,
    created_at: job.created_at,
    updated_at: job.updated_at,
    progress: job.progress,
    request: job.request ?? null,
    result: null,
    error: null,
  });
  if (error) throw new Error(`createJob: ${error.message}`);
  return job;
}

export async function updateJob(id: string, patch: Partial<JobRecord>): Promise<void> {
  const db = supabase();
  const updated_at = new Date().toISOString();
  if (!db) {
    const prev = memory.get(id);
    if (prev) memory.set(id, { ...prev, ...patch, updated_at });
    return;
  }
  const row: Record<string, unknown> = { updated_at };
  if (patch.status) row.status = patch.status;
  if (patch.progress) row.progress = patch.progress;
  if (patch.result) row.result = patch.result;
  if (patch.error !== undefined) row.error = patch.error;
  const { error } = await db.from(TABLE).update(row).eq("id", id);
  if (error) throw new Error(`updateJob: ${error.message}`);
}

export async function getJob(id: string): Promise<JobRecord | null> {
  const db = supabase();
  if (!db) return memory.get(id) ?? null;
  const { data, error } = await db.from(TABLE).select("*").eq("id", id).maybeSingle();
  if (error) throw new Error(`getJob: ${error.message}`);
  if (!data) return null;
  return {
    id: data.id,
    status: data.status,
    created_at: data.created_at,
    updated_at: data.updated_at,
    progress: data.progress ?? { analyzed: 0, total: 0 },
    request: data.request ?? undefined,
    result: data.result ?? undefined,
    error: data.error ?? undefined,
  };
}

export async function listJobs(limit = 20): Promise<JobRecord[]> {
  const db = supabase();
  if (!db) {
    return [...memory.values()]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, limit);
  }
  const { data, error } = await db
    .from(TABLE)
    .select("id,status,created_at,updated_at,progress")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listJobs: ${error.message}`);
  return (data ?? []) as JobRecord[];
}
