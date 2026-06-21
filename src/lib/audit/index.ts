/**
 * Audit logging — append-only, immutable record of all privileged actions.
 *
 * Audit log rows are NEVER updated or deleted by the application.
 * Direct DB access to modify audit_logs is considered a break-glass event
 * and is documented in docs/runbook.md.
 *
 * Action naming convention: "<entity>.<verb>"
 * e.g. "report.viewed", "status.changed", "recusal.applied", "user.invited"
 */
import { db } from "@/lib/db/client";
import type { Prisma } from "@prisma/client";

export type AuditAction =
  | "report.submitted"
  | "report.viewed"
  | "report.message_sent"
  | "report.note_added"
  | "status.changed"
  | "recusal.applied"
  | "escalation.triggered"
  | "user.invited"
  | "user.disabled"
  | "user.totp_enrolled"
  | "session.created"
  | "session.revoked"
  | "attachment.uploaded"
  | "break_glass.db_access";

interface LogEventParams {
  action: AuditAction;
  actorReviewerId?: string;
  reportId?: string;
  metadata?: Prisma.InputJsonObject;
}

/**
 * Write an audit log entry.
 * This is the ONLY function that writes to audit_logs — keep it fire-and-forget
 * safe (errors are logged but never thrown, so they don't block the main action).
 */
export async function logEvent({
  action,
  actorReviewerId,
  reportId,
  metadata,
}: LogEventParams): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        action,
        actorReviewerId: actorReviewerId ?? null,
        reportId: reportId ?? null,
        metadataJson: (metadata ?? {}) as Prisma.InputJsonValue,
      },
    });
  } catch (err) {
    // Never let audit failure block the user action — but do surface it
    console.error("[audit] Failed to write audit log:", err);
  }
}
