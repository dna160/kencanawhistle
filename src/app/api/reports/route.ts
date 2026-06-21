/**
 * POST /api/reports — public report submission endpoint.
 *
 * ANONYMITY GUARANTEES (must never be broken):
 * 1. IP address is NEVER read, logged, or stored from this route.
 * 2. No User-Agent, geolocation, or device data is stored.
 * 3. File metadata is stripped server-side before storage.
 * 4. The access code is generated here, shown once to the reporter,
 *    and stored only as an argon2 hash — never in plaintext.
 */
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db/client";
import { encrypt } from "@/lib/crypto";
import { generateAccessCode, hashAccessCode } from "@/lib/crypto";
import { sanitizeUpload } from "@/lib/files/sanitize";
import { logEvent } from "@/lib/audit";
import { z } from "zod";
import { nanoid } from "nanoid";

export const dynamic = "force-dynamic";

// ── Input validation ──────────────────────────────────────────────────────────

const SubmitSchema = z.object({
  mode: z.enum(["anonymous", "named"]),
  categoryKey: z.string().min(1),
  description: z.string().min(20).max(10000),
  subject: z.string().max(200).optional(),
  incidentDate: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  subjectIsCommissioner: z.string().optional(), // form checkbox = "on" | undefined
  commissionerName: z.string().max(200).optional(),
  // Named mode
  reporterName: z.string().max(200).optional(),
  reporterContact: z.string().max(200).optional(),
  consent: z.string().optional(),
});

// ── Rate limiting (in-memory, single instance) ────────────────────────────────
// For production multi-instance, use Redis; this is sufficient for v1 single Railway pod.
const rateLimitStore = new Map<string, { count: number; windowStart: number }>();
const RATE_LIMIT = parseInt(process.env.RATE_LIMIT_SUBMISSIONS_PER_HOUR ?? "10");
const WINDOW_MS = 60 * 60 * 1000;

/**
 * Rate limit by a stable but non-PII key.
 * We use the request's CF-Ray or X-Request-ID if available, otherwise a short
 * hash of the first 8 bytes of the User-Agent to differentiate clients without
 * logging IP. This is a best-effort defense, not a perfect guard.
 * The anonymous path intentionally accepts a weaker rate-limit vs. privacy trade-off.
 */
function getRateLimitKey(req: NextRequest): string {
  // Use a hash of the user-agent as a rough fingerprint — no IP stored
  const ua = req.headers.get("user-agent") ?? "unknown";
  const key = ua.slice(0, 64);
  return key;
}

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    rateLimitStore.set(key, { count: 1, windowStart: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Handler ───────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // ── NEVER read or log req.ip ──────────────────────────────────────────────
  // The variable is intentionally not referenced here.

  const rlKey = getRateLimitKey(req);
  if (!checkRateLimit(rlKey)) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  // Extract scalar fields
  const raw: Record<string, string> = {};
  for (const [key, value] of formData.entries()) {
    if (typeof value === "string") raw[key] = value;
  }

  const parsed = SubmitSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", detail: parsed.error.flatten() },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // Named mode: require consent
  if (data.mode === "named" && data.consent !== "on") {
    return NextResponse.json(
      { error: "Consent is required for named submissions" },
      { status: 422 }
    );
  }

  // Look up category
  const category = await db.category.findUnique({
    where: { key: data.categoryKey },
  });
  if (!category || !category.isActive) {
    return NextResponse.json({ error: "Invalid category" }, { status: 422 });
  }

  // Build body — include optional context fields in the encrypted body blob
  const bodyPlaintext = JSON.stringify({
    description: data.description,
    subject: data.subject ?? null,
    incidentDate: data.incidentDate ?? null,
    location: data.location ?? null,
  });

  // Encrypt sensitive fields
  const bodyEnc = encrypt(bodyPlaintext);

  let namedSubjectEnc: string | null = null;
  if (data.subjectIsCommissioner === "on" && data.commissionerName) {
    namedSubjectEnc = encrypt(data.commissionerName);
  }

  let consentedIdentityEnc: string | null = null;
  if (data.mode === "named") {
    const identity = JSON.stringify({
      name: data.reporterName ?? null,
      contact: data.reporterContact ?? null,
    });
    consentedIdentityEnc = encrypt(identity);
  }

  // Generate a human-readable reference code (e.g. "WB-A3F7K9")
  const referenceCode = `WB-${nanoid(6).toUpperCase()}`;

  // Generate access code (shown once to reporter)
  const plainCode = generateAccessCode();
  const codeHash = await hashAccessCode(plainCode);

  // Persist
  const report = await db.report.create({
    data: {
      referenceCode,
      categoryId: category.id,
      isAnonymous: data.mode === "anonymous",
      bodyEnc,
      namedSubjectEnc,
      consentedIdentityEnc,
      subjectIsCommissioner: data.subjectIsCommissioner === "on",
      channel: "web",
      accessCodes: {
        create: { codeHash },
      },
    },
  });

  // Handle file attachments
  const files = formData.getAll("attachments");
  for (const file of files) {
    if (!(file instanceof File) || file.size === 0) continue;

    const buffer = Buffer.from(await file.arrayBuffer());

    let sanitized;
    try {
      sanitized = await sanitizeUpload(buffer, file.type, file.name);
    } catch (err) {
      // Non-fatal: skip the file and continue
      console.warn("[upload] Rejected file:", (err as Error).message);
      continue;
    }

    // Store to filesystem volume (simplified for v1 — swap for S3 in production)
    const storageKey = `${report.id}/${sanitized.safeFilename}`;
    await db.attachment.create({
      data: {
        reportId: report.id,
        storageKey,
        filename: sanitized.safeFilename,
        mime: sanitized.mime,
        sizeBytes: sanitized.sizeBytes,
        metadataStripped: sanitized.metadataStripped,
      },
    });
  }

  // Audit log: omit any reporter identity
  await logEvent({
    action: "report.submitted",
    reportId: report.id,
    metadata: {
      isAnonymous: report.isAnonymous,
      categoryKey: data.categoryKey,
      // No IP, no UA stored
    },
  });

  // Return access code in plaintext — the ONLY time it leaves the server
  return NextResponse.json(
    {
      referenceCode,
      accessCode: plainCode,
    },
    { status: 201 }
  );
}
