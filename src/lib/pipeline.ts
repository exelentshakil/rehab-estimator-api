import { analyzePhoto, activeProvider } from "./vision";
import { buildResult } from "./engine";
import { getJob, updateJob } from "./store";
import type { EvaluationResult, PhotoAnalysis } from "./types";

/**
 * Inline execution path.
 *
 * Identical pipeline to the Inngest function, run in-request. Used when no
 * Inngest event key is configured (local dev, first-run demos) and for small
 * photo sets where a round trip through the queue is not worth the latency.
 * Above ~12 photos the async path is strongly preferred.
 */
export async function runEvaluationInline(jobId: string): Promise<EvaluationResult> {
  const job = await getJob(jobId);
  if (!job?.request) throw new Error(`job ${jobId} has no request payload`);

  const { photos, property } = job.request;
  await updateJob(jobId, { status: "analyzing", progress: { analyzed: 0, total: photos.length } });

  const BATCH = 6;
  const analyses: PhotoAnalysis[] = [];
  let provider = activeProvider();
  let model = "unknown";

  for (let i = 0; i < photos.length; i += BATCH) {
    const slice = photos.slice(i, i + BATCH);
    const results = await Promise.all(
      slice.map((photo, k) => analyzePhoto(photo, photo.id ?? `p${i + k + 1}`, property, i + k)),
    );
    for (const r of results) {
      analyses.push(r.analysis);
      provider = r.provider;
      if (r.model !== "error") model = r.model;
    }
    await updateJob(jobId, { progress: { analyzed: analyses.length, total: photos.length } });
  }

  await updateJob(jobId, { status: "pricing" });

  const result = buildResult({
    jobId,
    createdAt: job.created_at,
    request: job.request,
    analyses,
    model: { provider, model },
  });

  await updateJob(jobId, { status: "complete", result });
  return result;
}

export function asyncEnabled(): boolean {
  return Boolean(process.env.INNGEST_EVENT_KEY);
}
