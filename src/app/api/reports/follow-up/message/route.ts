/**
 * POST /api/reports/follow-up/message
 * Reporter sends a follow-up message to reviewers using their access code.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { verifyAccessCode } from "@/lib/crypto";
import { encrypt, decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/audit";
import { z } from "zod";

export const dynamic = "force-dynamic";

const MessageSchema = z.object({
  accessCode: z.string().min(1),
  body: z.string().min(1).max(5000),
});

export async function POST(req: NextRequest) {
  let raw: unknown;
  try { raw = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = MessageSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed" }, { status: 422 });
  }

  const { accessCode, body } = parsed.data;

  // Verify access code
  const accessCodes = await db.accessCode.findMany();
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

  // Check report is not closed
  const report = await db.report.findUnique({ where: { id: matchedCode.reportId } });
  if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (report.status === "closed") {
    return NextResponse.json({ error: "This report is closed" }, { status: 400 });
  }

  const bodyEnc = encrypt(body);
  const message = await db.reportMessage.create({
    data: {
      reportId: matchedCode.reportId,
      sender: "reporter",
      bodyEnc,
    },
  });

  await logEvent({
    action: "report.message_sent",
    reportId: matchedCode.reportId,
    metadata: { sender: "reporter" },
  });

  return NextResponse.json({
    id: message.id,
    sender: message.sender,
    body: decrypt(message.bodyEnc),
    createdAt: message.createdAt.toISOString(),
  }, { status: 201 });
}
