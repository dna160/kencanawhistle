/**
 * POST /api/cases/[id]/message — Reviewer sends a message to reporter.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCaseAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { recusalFilter } from "@/lib/recusal";
import { encrypt, decrypt } from "@/lib/crypto";
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
  if (report.status === "closed") {
    return NextResponse.json({ error: "Cannot message on a closed report" }, { status: 400 });
  }

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid" }, { status: 422 });

  const message = await db.reportMessage.create({
    data: {
      reportId: id,
      sender: "reviewer",
      bodyEnc: encrypt(parsed.data.body),
      authorReviewerId: reviewer.reviewerId,
    },
  });

  await logEvent({
    action: "report.message_sent",
    actorReviewerId: reviewer.reviewerId,
    reportId: id,
    metadata: { sender: "reviewer" },
  });

  return NextResponse.json({
    id: message.id,
    sender: message.sender,
    body: decrypt(message.bodyEnc),
    createdAt: message.createdAt.toISOString(),
  }, { status: 201 });
}
