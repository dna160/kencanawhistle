/**
 * Recusal enforcement — query-layer implementation.
 *
 * A recused reviewer NEVER sees the hidden report in any query result.
 * This is enforced at the data layer, not just the UI.
 *
 * The key Prisma pattern for all report list / report detail queries:
 *
 *   where: {
 *     ...recusalFilter(reviewerId),
 *   }
 *
 * which translates to:
 *   NOT EXISTS (SELECT 1 FROM recusals WHERE report_id = r.id AND reviewer_id = ?)
 */
import { db } from "@/lib/db/client";
import { logEvent } from "@/lib/audit";

/**
 * Returns a Prisma `where` fragment that excludes reports recused for this reviewer.
 * Compose this into every reviewer-facing report query.
 */
export function recusalFilter(reviewerId: string) {
  return {
    recusals: {
      none: {
        reviewerId,
      },
    },
  };
}

/**
 * Apply a recusal: hide a report from a reviewer.
 * Idempotent — safe to call if the recusal already exists.
 */
export async function applyRecusal({
  reportId,
  reviewerId,
  reason,
  actorReviewerId,
}: {
  reportId: string;
  reviewerId: string;
  reason?: string;
  actorReviewerId: string;
}) {
  await db.recusal.upsert({
    where: { reportId_reviewerId: { reportId, reviewerId } },
    update: {},
    create: { reportId, reviewerId, reason },
  });

  await logEvent({
    action: "recusal.applied",
    actorReviewerId,
    reportId,
    metadata: { recusedReviewerId: reviewerId, reason },
  });
}

/**
 * Check quorum: how many active, non-recused commissioners remain for this report?
 * If count < RECUSAL_QUORUM, the caller should trigger external escalation.
 */
export async function getEligibleCommissionerCount(reportId: string): Promise<number> {
  const recusedIds = await db.recusal.findMany({
    where: { reportId },
    select: { reviewerId: true },
  });
  const recusedSet = new Set(recusedIds.map((r) => r.reviewerId));

  const commissioners = await db.reviewer.findMany({
    where: { role: "commissioner", isActive: true },
    select: { id: true },
  });

  return commissioners.filter((c) => !recusedSet.has(c.id)).length;
}

/**
 * Escalate a report to the external party when quorum is lost.
 */
export async function escalateToExternal({
  reportId,
  reason,
  actorReviewerId,
}: {
  reportId: string;
  reason: string;
  actorReviewerId: string;
}) {
  const external = await db.reviewer.findFirst({
    where: { role: "external", isActive: true },
  });

  if (!external) {
    console.error("[recusal] No active external escalation party found for report", reportId);
    return;
  }

  await db.$transaction([
    db.escalation.create({
      data: { reportId, toReviewerId: external.id, reason },
    }),
    db.report.update({
      where: { id: reportId },
      data: { status: "escalated" },
    }),
  ]);

  await logEvent({
    action: "escalation.triggered",
    actorReviewerId,
    reportId,
    metadata: { toReviewerId: external.id, reason },
  });
}
