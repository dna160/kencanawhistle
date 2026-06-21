/**
 * ONE-TIME setup endpoint — creates the first admin user.
 * Protected by SETUP_SECRET env var.
 * DELETE THIS FILE after first use.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import argon2 from "argon2";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-setup-secret");
  if (!secret || secret !== process.env.SETUP_SECRET) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { email, password, displayName, role } = await req.json();

  const hash = await argon2.hash(password, { type: argon2.argon2id });

  const reviewer = await db.reviewer.upsert({
    where: { email },
    update: { passwordHash: hash, role, isActive: true, displayName },
    create: { email, displayName, role, passwordHash: hash, isActive: true },
  });

  return NextResponse.json({
    id: reviewer.id,
    email: reviewer.email,
    role: reviewer.role,
    isActive: reviewer.isActive,
  });
}
