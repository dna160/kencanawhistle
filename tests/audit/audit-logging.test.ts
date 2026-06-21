/**
 * Audit logging tests.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

// Mocks must use inline jest.fn() — const references are not hoisted with jest.mock()
jest.mock("@/lib/db/client", () => ({
  db: {
    auditLog: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
}));

import { logEvent, type AuditAction } from "@/lib/audit";
import { db } from "@/lib/db/client";

const mockAuditCreate = db.auditLog.create as jest.MockedFunction<typeof db.auditLog.create>;

describe("logEvent()", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  it("writes a row to audit_logs with action, reportId, and actorReviewerId", async () => {
    await logEvent({
      action: "report.viewed",
      actorReviewerId: "reviewer-1",
      reportId: "report-1",
      metadata: { foo: "bar" },
    });

    expect(mockAuditCreate).toHaveBeenCalledTimes(1);
    expect(mockAuditCreate).toHaveBeenCalledWith({
      data: {
        action: "report.viewed",
        actorReviewerId: "reviewer-1",
        reportId: "report-1",
        metadataJson: { foo: "bar" },
      },
    });
  });

  it("stores null actorReviewerId for system actions", async () => {
    await logEvent({
      action: "report.submitted",
      reportId: "report-2",
    });

    const call = mockAuditCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.actorReviewerId).toBeNull();
  });

  it("stores null reportId for user management actions", async () => {
    await logEvent({
      action: "user.invited",
      actorReviewerId: "admin-1",
      metadata: { invitedEmail: "new@example.com" },
    });

    const call = mockAuditCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.reportId).toBeNull();
  });

  it("does NOT throw when DB write fails (fire-and-forget)", async () => {
    mockAuditCreate.mockRejectedValueOnce(new Error("DB connection lost") as never);

    await expect(
      logEvent({ action: "report.viewed", actorReviewerId: "r1", reportId: "p1" })
    ).resolves.toBeUndefined();
  });

  it("logs an error to console when DB write fails", async () => {
    const consoleSpy = jest.spyOn(console, "error");
    mockAuditCreate.mockRejectedValueOnce(new Error("DB down") as never);
    await logEvent({ action: "status.changed", actorReviewerId: "r1", reportId: "p1" });
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("stores an empty object for metadata when not provided", async () => {
    await logEvent({ action: "session.created", actorReviewerId: "r1" });
    const call = mockAuditCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(call.data.metadataJson).toEqual({});
  });
});

describe("Audit — no reporter identity in anonymous report events", () => {
  beforeEach(() => jest.clearAllMocks());

  it("report.submitted event contains no IP, UA, or reporter identity", async () => {
    await logEvent({
      action: "report.submitted",
      reportId: "report-anon-1",
      metadata: {
        isAnonymous: true,
        categoryKey: "fraud",
      },
    });

    const call = mockAuditCreate.mock.calls[0][0] as {
      data: { metadataJson: Record<string, unknown> };
    };
    const meta = call.data.metadataJson;

    expect(meta).not.toHaveProperty("ip");
    expect(meta).not.toHaveProperty("ipAddress");
    expect(meta).not.toHaveProperty("userAgent");
    expect(meta).not.toHaveProperty("reporterName");
    expect(meta).not.toHaveProperty("contact");
    expect(meta).not.toHaveProperty("email");
    expect(meta).not.toHaveProperty("identity");
  });

  it("report.viewed event identifies the reviewing actor, not the reporter", async () => {
    await logEvent({
      action: "report.viewed",
      actorReviewerId: "commissioner-7",
      reportId: "report-anon-1",
      metadata: {},
    });

    const call = mockAuditCreate.mock.calls[0][0] as {
      data: { actorReviewerId: string };
    };
    expect(call.data.actorReviewerId).toBe("commissioner-7");
  });
});

describe("Audit action coverage", () => {
  beforeEach(() => jest.clearAllMocks());

  const allActions: AuditAction[] = [
    "report.submitted",
    "report.viewed",
    "report.message_sent",
    "report.note_added",
    "status.changed",
    "recusal.applied",
    "escalation.triggered",
    "user.invited",
    "user.disabled",
    "user.totp_enrolled",
    "session.created",
    "session.revoked",
    "attachment.uploaded",
    "break_glass.db_access",
  ];

  it.each(allActions)("can log action: %s", async (action) => {
    await logEvent({ action, actorReviewerId: "r1", reportId: "p1" });
    expect(mockAuditCreate).toHaveBeenCalled();
    mockAuditCreate.mockClear();
  });
});
