import { NextResponse } from "next/server";
import { EvaluateRequest } from "@/lib/types";
import { createJob, newJobId, getJob } from "@/lib/store";
import { runEvaluationInline, asyncEnabled } from "@/lib/pipeline";
import { inngest } from "@/lib/inngest";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * POST /api/evaluate
 *
 * Body: { property, photos[5..50], options? }
 *
 * Returns 202 + { job_id } when the async queue is configured, or 200 + the
 * full evaluation when running inline. Pass `?mode=sync` to force inline.
 */
export async function POST(req: Request) {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json", message: "Body must be JSON." }, { status: 400 });
  }

  const parsed = EvaluateRequest.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "validation_failed",
        message: "Request did not match the evaluation schema.",
        issues: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
      },
      { status: 422 },
    );
  }

  const request = parsed.data;
  const now = new Date().toISOString();
  const jobId = newJobId();

  await createJob({
    id: jobId,
    status: "queued",
    created_at: now,
    updated_at: now,
    progress: { analyzed: 0, total: request.photos.length },
    request,
  });

  const url = new URL(req.url);
  const forceSync = url.searchParams.get("mode") === "sync";

  if (asyncEnabled() && !forceSync) {
    await inngest.send({ name: "rehab/evaluation.requested", data: { job_id: jobId } });
    return NextResponse.json(
      {
        job_id: jobId,
        status: "queued",
        photos: request.photos.length,
        poll: `/api/jobs/${jobId}`,
      },
      { status: 202 },
    );
  }

  try {
    const result = await runEvaluationInline(jobId);
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "evaluation failed";
    const job = await getJob(jobId);
    return NextResponse.json(
      { error: "evaluation_failed", message, job_id: jobId, status: job?.status },
      { status: 500 },
    );
  }
}
