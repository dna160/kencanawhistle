/**
 * Notifications worker — content-free reviewer alerts.
 *
 * PRIVACY GUARANTEE: Notification email payloads must NEVER contain:
 * - Report body or any report content
 * - Reporter identity (name, contact, access code)
 * - Category details that could identify the reporter
 *
 * Notifications contain only: a link to log in and review new cases.
 * Reviewers must authenticate to see case details.
 */
import nodemailer from "nodemailer";
import { db } from "@/lib/db/client";

/**
 * Sanitize a string for use in email headers/body.
 * Strips CRLF sequences to mitigate nodemailer CRLF injection (GHSA-vvjj-xcjg-gr5g,
 * GHSA-c7w3-x93f-qmm8) — no upstream fix available as of v7.x.
 * We never use the `raw` or `jsonTransport` options (GHSA-p6gq-j5cr-w38f, GHSA-wqvq-jvpq-h66f).
 */
function sanitizeForEmail(s: string): string {
  return s.replace(/[\r\n]/g, " ").trim();
}

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT ?? "587"),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

/**
 * Send content-free notification to all active commissioners about a new report.
 * Called after successful report submission.
 */
export async function notifyReviewersNewReport(reportId: string): Promise<void> {
  const commissioners = await db.reviewer.findMany({
    where: { role: "commissioner", isActive: true },
    select: { email: true, displayName: true },
  });

  const appUrl = process.env.APP_BASE_URL ?? "https://your-app.up.railway.app";

  for (const commissioner of commissioners) {
    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: sanitizeForEmail(commissioner.email),
        subject: "New report requires your attention",
        text: [
          `Dear ${sanitizeForEmail(commissioner.displayName)},`,
          "",
          "A new report has been submitted and requires acknowledgement within 7 days.",
          "",
          "Please sign in to the platform to review it:",
          `${appUrl}/cases`,
          "",
          "This notification does not contain the report contents for security reasons.",
          "You must authenticate to view case details.",
          "",
          "— Speak Up Platform",
        ].join("\n"),
        html: `
          <p>Dear ${sanitizeForEmail(commissioner.displayName)},</p>
          <p>A new report has been submitted and requires acknowledgement within 7 days.</p>
          <p><a href="${appUrl}/cases" style="font-weight: bold;">Sign in to review cases →</a></p>
          <p style="color: #666; font-size: 0.875em;">
            This notification intentionally contains no report details for security.
            Please authenticate to view case information.
          </p>
        `,
      });
    } catch (err) {
      console.error(`[notifications] Failed to notify ${commissioner.email}:`, err);
    }
  }
}

/**
 * Notify external escalation party that a case has been escalated to them.
 */
export async function notifyExternalEscalation(
  reportRef: string,
  toEmail: string
): Promise<void> {
  const appUrl = process.env.APP_BASE_URL ?? "https://your-app.up.railway.app";

  try {
    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: toEmail,
      subject: "A case has been escalated for your review",
      text: [
        "A whistleblowing case has been escalated to you for independent review.",
        "",
        "This escalation was triggered because the Board of Commissioners reached",
        "or fell below the minimum quorum of non-conflicted reviewers.",
        "",
        "Please sign in to review the case:",
        `${appUrl}/cases`,
        "",
        "— Speak Up Platform",
      ].join("\n"),
    });
  } catch (err) {
    console.error("[notifications] Failed to notify external escalation party:", err);
  }
}
