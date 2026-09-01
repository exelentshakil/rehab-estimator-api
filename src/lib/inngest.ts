import { Inngest } from "inngest";
import { analyzePhoto, activeProvider } from "./vision";
import { buildResult } from "./engine";
import { getJob, updateJob } from "./store";
import type { PhotoAnalysis } from "./types";

export const inngest = new Inngest({ id: "rehab-estimator" });

/**
 * The orchestration.
 *
 * Photo analysis is fanned out with a concurrency cap so 50 photos do not open
 * 50 simultaneous vision calls. Every step is individually retried and cached
 * by Inngest, so a transient 503 from the model provider re-runs one photo
 * rather than the whole job.
 *
 * Steps 4-6 (quantities → cost book → rollup) are pure and live in engine.ts,
 * so a re-price after a cost-book update never touches the vision provider.
 */
export const evaluateProperty = inngest.createFunction(
  {
    id: "evaluate-property",
    name: "Evaluate property condition & rehab cost",
    retries: 2,
    concurrency: { limit: 5 },
    onFailure: async ({ event, error }) => {
      const jobId = (event.data as { event?: { data?: { job_id?: string } } })?.event?.data?.job_id;
      if (jobId) await updateJob(jobId, { status: "failed", error: String(error).slice(0, 500) });
    },
  },
  { event: "rehab/evaluation.requested" },
  async ({ event, step }) => {
    const jobId = event.data.job_id as string;

    const job = await step.run("load-job", async () => {
      const j = await getJob(jobId);
      if (!j?.request) throw new Error(`job ${jobId} has no request payload`);
      return j;
    });

    const request = job.request!;
    const photos = request.photos;

    await step.run("mark-analyzing", () =>
      updateJob(jobId, { status: "analyzing", progress: { analyzed: 0, total: photos.length } }),
    );

    // Fan out in batches — bounded parallelism keeps us inside provider rate
    // limits while still finishing 25 photos in well under a minute.
    const BATCH = 6;
    const analyses: PhotoAnalysis[] = [];
    let provider = activeProvider();
    let model = "unknown";

    for (let i = 0; i < photos.length; i += BATCH) {
      const slice = photos.slice(i, i + BATCH);
      const batch = await step.run(`analyze-batch-${i / BATCH}`, async () => {
        const results = await Promise.all(
          slice.map((photo, k) =>
            analyzePhoto(photo, photo.id ?? `p${i + k + 1}`, request.property, i + k),
          ),
        );
        return results;
      });

      for (const r of batch) {
        analyses.push(r.analysis);
        provider = r.provider;
        if (r.model !== "error") model = r.model;
      }

      await step.run(`progress-${i / BATCH}`, () =>
        updateJob(jobId, { progress: { analyzed: analyses.length, total: photos.length } }),
      );
    }

    // Deterministic half. No I/O, no model — pure computation over observations.
    const result = await step.run("score-and-price", async () => {
      await updateJob(jobId, { status: "pricing" });
      return buildResult({
        jobId,
        createdAt: job.created_at,
        request,
        analyses,
        model: { provider, model },
      });
    });

    await step.run("persist-result", () => updateJob(jobId, { status: "complete", result }));

    return { job_id: jobId, overall_score: result.condition.overall_score, expected: result.estimate.expected };
  },
);

export const functions = [evaluateProperty];
