/**
 * PATCH /api/cases/[id]/status — Change report status.
 * Commissioner only. Validates allowed transitions.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireCaseAccess, forbidden } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { recusalFilter } from "@/lib/recusal";
import { logEvent } from "@/lib/audit";
import { z } from "zod";
import type { ReportStatus } from "@prisma/client";

const VALID_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  new: ["acknowledged"],
  acknowledged: ["under_review"],
  under_review: ["action_taken", "escalated"],
  action_taken: ["closed"],
  closed: [],
  escalated: ["closed"],
};

const Schema = z.object({
  status: z.enum(["new", "acknowledged", "under_review", "action_taken", "closed", "escalated"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const reviewer = await requireCaseAccess();
  const { id } = await params;

  // Verify reviewer has access to this case (recusal check)
  const report = await db.report.findFirst({
    where: { id, ...recusalFilter(reviewer.reviewerId) },
  });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status" }, { status: 422 });
  }

  const newStatus = parsed.data.status;
  const allowed = VALID_TRANSITIONS[report.status];
  if (!allowed.includes(newStatus)) {
    return NextResponse.json(
      { error: `Cannot transition from ${report.status} to ${newStatus}` },
      { status: 400 }
    );
  }

  const updated = await db.report.update({
    where: { id },
    data: {
      status: newStatus,
      acknowledgedAt: newStatus === "acknowledged" ? new Date() : undefined,
      closedAt: newStatus === "closed" ? new Date() : undefined,
    },
  });

  await logEvent({
    action: "status.changed",
    actorReviewerId: reviewer.reviewerId,
    reportId: id,
    metadata: { from: report.status, to: newStatus },
  });

  return NextResponse.json({ status: updated.status });
}
