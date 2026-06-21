/**
 * POST /api/cases/[id]/note — Add internal reviewer note (not visible to reporter).
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { recusalFilter } from "@/lib/recusal";
import { encrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/audit";
import { z } from "zod";

const Schema = z.object({ body: z.string().min(1).max(5000) });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reviewer = await requireCaseAccess();
  const { id } = await params;

  const report = await db.report.findFirst({
    where: { id, ...recusalFilter(reviewer.reviewerId) },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 422 });

  await db.reportNote.create({
    data: {
      reportId: id,
      authorReviewerId: reviewer.reviewerId,
      bodyEnc: encrypt(parsed.data.body),
    },
  });

  await logEvent({
    action: "report.note_added",
    actorReviewerId: reviewer.reviewerId,
    reportId: id,
  });

  return NextResponse.json({ success: true }, { status: 201 });
}
