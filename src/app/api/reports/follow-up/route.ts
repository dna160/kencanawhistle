/**
 * POST /api/reports/follow-up
 *
 * Reporter enters their access code to retrieve their report thread.
 * ANONYMITY: No IP logged. Rate limited by UA-hash.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { verifyAccessCode } from "@/lib/crypto";
import { decrypt } from "@/lib/crypto";

export const dynamic = "force-dynamic";

// Rate limit: code attempts
const codeAttemptStore = new Map<string, { count: number; windowStart: number }>();
const CODE_LIMIT = parseInt(process.env.RATE_LIMIT_CODE_ATTEMPTS_PER_15MIN ?? "5");
const CODE_WINDOW = 15 * 60 * 1000;

function checkCodeRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = codeAttemptStore.get(key);
  if (!entry || now - entry.windowStart > CODE_WINDOW) {
    codeAttemptStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= CODE_LIMIT) return false;
  entry.count++;
  return true;
}

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent")?.slice(0, 64) ?? "unknown";
  if (!checkCodeRateLimit(ua)) {
    return NextResponse.json({ error: "Too many attempts" }, { status: 429 });
  }

  let body: { accessCode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { accessCode } = body;
  if (!accessCode || typeof accessCode !== "string") {
    return NextResponse.json({ error: "Access code required" }, { status: 400 });
  }

  // Find all access codes and verify — we don't know which report it belongs to
  // without scanning, so we search by trying hashes
  // For efficiency, we store a truncated prefix-hint in production; for v1 scan all
  const accessCodes = await db.accessCode.findMany({
    include: {
      report: {
        include: {
          category: true,
          messages: {
            orderBy: { createdAt: "asc" },
          },
        },
      },
    },
  });

  let matchedCode = null;
  for (const ac of accessCodes) {
    if (await verifyAccessCode(accessCode, ac.codeHash)) {
      matchedCode = ac;
      break;
    }
  }

  if (!matchedCode) {
    return NextResponse.json({ error: "Invalid access code" }, { status: 401 });
  }

  // Update last used timestamp
  await db.accessCode.update({
    where: { id: matchedCode.id },
    data: { lastUsedAt: new Date() },
  });

  const report = matchedCode.report;

  // Decrypt messages for display
  const messages = report.messages.map((m) => ({
    id: m.id,
    sender: m.sender,
    body: decrypt(m.bodyEnc),
    createdAt: m.createdAt.toISOString(),
  }));

  return NextResponse.json({
    referenceCode: report.referenceCode,
    status: report.status,
    category: {
      labelEn: report.category.labelEn,
      labelId: report.category.labelId,
    },
    messages,
  });
}
