import { NextResponse } from "next/server";
import { activeProvider } from "@/lib/vision";
import { storageBackend } from "@/lib/store";
import { asyncEnabled } from "@/lib/pipeline";
import { costBookMeta } from "@/lib/costbook";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const provider = activeProvider();
  return NextResponse.json({
    ok: true,
    vision_provider: provider,
    vision_live: provider !== "simulator",
    queue: asyncEnabled() ? "inngest" : "inline",
    storage: storageBackend(),
    costbook: { version: costBookMeta.version, items: costBookMeta.item_count },
  });
}
