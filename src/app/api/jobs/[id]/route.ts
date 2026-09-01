import { NextResponse } from "next/server";
import { getJob } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** GET /api/jobs/{id} — poll a job, or fetch the completed evaluation. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const job = await getJob(id);

  if (!job) {
    return NextResponse.json({ error: "not_found", message: `No job ${id}.` }, { status: 404 });
  }

  if (job.status === "complete" && job.result) {
    return NextResponse.json(job.result);
  }

  return NextResponse.json(
    {
      job_id: job.id,
      status: job.status,
      progress: job.progress,
      created_at: job.created_at,
      updated_at: job.updated_at,
      ...(job.error ? { error: job.error } : {}),
    },
    { status: job.status === "failed" ? 500 : 200 },
  );
}
