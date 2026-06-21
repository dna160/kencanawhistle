/**
 * GET  /api/auth/setup-totp  — Generate a new TOTP secret + QR URI for reviewer
 * POST /api/auth/setup-totp  — Verify the first TOTP code to complete enrolment
 */
import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/rbac";
import {
  generateTOTPSecret,
  encryptTOTPSecret,
  generateTOTPUri,
  verifyTOTP,
} from "@/lib/auth/totp";
import { db } from "@/lib/db/client";
import { logEvent } from "@/lib/audit";
import { z } from "zod";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/** GET: start TOTP enrolment — generate secret + QR code */
export async function GET() {
  const reviewer = await requireAuth();

  const secret = generateTOTPSecret();
  const uri = generateTOTPUri(reviewer.email, secret);
  const qrDataUrl = await QRCode.toDataURL(uri);

  // Temporarily store the plaintext secret in session (encrypted in DB after verify)
  // We encrypt it now and store it; if they don't verify, we overwrite next time
  const encSecret = encryptTOTPSecret(secret);
  await db.reviewer.update({
    where: { id: reviewer.reviewerId },
    data: { totpSecretEnc: encSecret, totpVerified: false },
  });

  return NextResponse.json({ qrDataUrl, secret });
}

/** POST: verify the first TOTP code to activate 2FA */
export async function POST(req: NextRequest) {
  const reviewer = await requireAuth();

  const body = await req.json();
  const parsed = z.object({ code: z.string().length(6) }).safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid code" }, { status: 422 });
  }

  const dbReviewer = await db.reviewer.findUnique({ where: { id: reviewer.reviewerId } });
  if (!dbReviewer?.totpSecretEnc) {
    return NextResponse.json({ error: "No TOTP secret found. Start setup again." }, { status: 400 });
  }

  const ok = await verifyTOTP(dbReviewer.totpSecretEnc, parsed.data.code);
  if (!ok) {
    return NextResponse.json({ error: "Invalid code" }, { status: 401 });
  }

  await db.reviewer.update({
    where: { id: reviewer.reviewerId },
    data: { totpVerified: true },
  });

  await logEvent({
    action: "user.totp_enrolled",
    actorReviewerId: reviewer.reviewerId,
  });

  return NextResponse.json({ success: true });
}
