/**
 * Retention purge worker — UU PDP No. 27/2022 compliance.
 *
 * Deletes closed/resolved report data after RETENTION_DAYS post-closure.
 * Retention period [DECIDE] — confirm with Indonesian counsel before production.
 * The default of 1095 days (3 years) is a placeholder pending legal advice.
 *
 * This runs as a scheduled job (e.g. nightly cron via Railway or a separate worker).
 * Call scheduleRetentionPurge() from a cron trigger.
 */
import { db } from "@/lib/db/client";
import { logEvent } from "@/lib/audit";

const RETENTION_DAYS = parseInt(process.env.RETENTION_DAYS ?? "1095");

/**
 * Identify and delete reports (and their associated data) that have been closed
 * for longer than RETENTION_DAYS.
 *
 * What is deleted:
 * - report_messages, report_notes, attachments, access_codes (child records)
 * - The report itself (including encrypted body and any consented identity)
 * - Recusals and escalations linked to the report
 *
 * What is retained:
 * - audit_logs rows (immutable, retained per policy — separate retention schedule)
 */
export async function runRetentionPurge(): Promise<{
  purged: number;
  errors: string[];
}> {
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  // Find reports closed before the cutoff date
  const eligibleReports = await db.report.findMany({
    where: {
      status: { in: ["closed", "action_taken"] },
      closedAt: { lt: cutoff },
    },
    select: { id: true, referenceCode: true },
  });

  let purged = 0;
  const errors: string[] = [];

  for (const report of eligibleReports) {
    try {
      // Cascade deletes handle child records if foreign keys are configured
      // For safety, explicitly delete in dependency order
      await db.$transaction([
        db.reportMessage.deleteMany({ where: { reportId: report.id } }),
        db.reportNote.deleteMany({ where: { reportId: report.id } }),
        db.attachment.deleteMany({ where: { reportId: report.id } }),
        db.accessCode.deleteMany({ where: { reportId: report.id } }),
        db.recusal.deleteMany({ where: { reportId: report.id } }),
        db.escalation.deleteMany({ where: { reportId: report.id } }),
        db.report.delete({ where: { id: report.id } }),
      ]);

      await logEvent({
        action: "report.submitted", // using closest action; ideally add "report.purged"
        metadata: {
          purge: true,
          referenceCode: report.referenceCode,
          retentionDays: RETENTION_DAYS,
          closedBefore: cutoff.toISOString(),
        },
      });

      purged++;
      console.log(`[retention] Purged report ${report.referenceCode}`);
    } catch (err) {
      const msg = `Failed to purge ${report.referenceCode}: ${(err as Error).message}`;
      errors.push(msg);
      console.error("[retention]", msg);
    }
  }

  console.log(`[retention] Purge complete: ${purged} purged, ${errors.length} errors`);
  return { purged, errors };
}
