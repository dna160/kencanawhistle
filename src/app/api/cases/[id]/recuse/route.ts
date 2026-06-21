/**
 * POST /api/cases/[id]/recuse — Apply recusal for the requesting reviewer.
 * Triggers escalation check after applying.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import {
  applyRecusal,
  getEligibleCommissionerCount,
  escalateToExternal,
} from "@/lib/recusal";
import { z } from "zod";

const Schema = z.object({ reason: z.string().max(500).optional() });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Only commissioners can self-recuse
  const reviewer = await requireRole("commissioner");
  const { id } = await params;

  const report = await db.report.findUnique({ where: { id } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = Schema.safeParse(body);

  await applyRecusal({
    reportId: id,
    reviewerId: reviewer.reviewerId,
    reason: parsed.success ? parsed.data.reason : undefined,
    actorReviewerId: reviewer.reviewerId,
  });

  // Check if quorum is now below threshold
  const quorum = parseInt(process.env.RECUSAL_QUORUM ?? "2");
  const eligible = await getEligibleCommissionerCount(id);
  if (eligible < quorum) {
    await escalateToExternal({
      reportId: id,
      reason: `Quorum lost: only ${eligible} non-conflicted commissioner(s) remain (threshold: ${quorum})`,
      actorReviewerId: reviewer.reviewerId,
    });
  }

  return NextResponse.json({ success: true, eligibleCommissioners: eligible });
}
