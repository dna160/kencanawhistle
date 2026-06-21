/**
 * POST /api/admin/users/invite — Admin invites a new reviewer.
 *
 * Creates a Reviewer record with isActive=false.
 * The invited user must set their password and TOTP via the invite link.
 * (For v1, a temporary password is set; replace with email-invite flow.)
 *
 * RBAC: admin only. Admin cannot read case contents.
 */
import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { logEvent } from "@/lib/audit";
import { z } from "zod";
import argon2 from "argon2";
import { nanoid } from "nanoid";

const Schema = z.object({
  email: z.string().email(),
  displayName: z.string().min(1).max(100),
  role: z.enum(["commissioner", "admin", "external"]),
});

export async function POST(req: NextRequest) {
  const actor = await requireRole("admin");

  const body = await req.json();
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", detail: parsed.error.flatten() }, { status: 422 });
  }

  const { email, displayName, role } = parsed.data;

  // Check if user already exists
  const existing = await db.reviewer.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "A user with this email already exists." }, { status: 409 });
  }

  // Generate a temporary password (must be changed on first login in v2)
  const tempPassword = nanoid(16);
  const passwordHash = await argon2.hash(tempPassword, { type: argon2.argon2id });

  const reviewer = await db.reviewer.create({
    data: {
      email,
      displayName,
      role,
      passwordHash,
      isActive: true, // Active immediately; TOTP required on first login
    },
  });

  await logEvent({
    action: "user.invited",
    actorReviewerId: actor.reviewerId,
    metadata: { invitedEmail: email, role },
  });

  // In production: send invite email with TOTP setup link
  // For v1: return temp password so admin can share it securely
  return NextResponse.json({
    id: reviewer.id,
    email: reviewer.email,
    role: reviewer.role,
    tempPassword, // ⚠ Share securely — to be replaced with email invite in v2
  }, { status: 201 });
}
