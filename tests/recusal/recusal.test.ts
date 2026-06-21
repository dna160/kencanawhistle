/**
 * Recusal enforcement tests.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";

jest.mock("@/lib/db/client", () => ({
  db: {
    recusal: {
      upsert: jest.fn().mockResolvedValue({}),
      findMany: jest.fn(),
    },
    reviewer: {
      findMany: jest.fn(),
      findFirst: jest.fn().mockResolvedValue({
        id: "ext-1",
        role: "external",
        isActive: true,
      }),
    },
    escalation: { create: jest.fn().mockResolvedValue({}) },
    report: { update: jest.fn().mockResolvedValue({}) },
    auditLog: { create: jest.fn().mockResolvedValue({}) },
    $transaction: jest.fn().mockImplementation(async (ops: unknown[]) => {
      for (const op of ops) await op;
    }),
  },
}));

jest.mock("@/lib/audit", () => ({
  logEvent: jest.fn().mockResolvedValue(undefined),
}));

import { recusalFilter, applyRecusal, getEligibleCommissionerCount } from "@/lib/recusal";
import { db } from "@/lib/db/client";
import { logEvent } from "@/lib/audit";

const mockRecusalUpsert = db.recusal.upsert as jest.MockedFunction<typeof db.recusal.upsert>;
const mockRecusalFindMany = db.recusal.findMany as jest.MockedFunction<typeof db.recusal.findMany>;
const mockReviewerFindMany = db.reviewer.findMany as jest.MockedFunction<typeof db.reviewer.findMany>;
const mockLogEvent = logEvent as jest.MockedFunction<typeof logEvent>;

describe("recusalFilter()", () => {
  it("returns a Prisma where clause with recusals.none for the given reviewerId", () => {
    const filter = recusalFilter("reviewer-123");
    expect(filter).toEqual({
      recusals: {
        none: {
          reviewerId: "reviewer-123",
        },
      },
    });
  });

  it("uses different reviewerIds for different callers", () => {
    const f1 = recusalFilter("r-1");
    const f2 = recusalFilter("r-2");
    expect(f1.recusals.none.reviewerId).toBe("r-1");
    expect(f2.recusals.none.reviewerId).toBe("r-2");
  });
});

describe("applyRecusal()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("calls db.recusal.upsert with correct reportId and reviewerId", async () => {
    await applyRecusal({
      reportId: "report-1",
      reviewerId: "reviewer-2",
      reason: "I know the subject personally",
      actorReviewerId: "reviewer-2",
    });

    expect(mockRecusalUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { reportId_reviewerId: { reportId: "report-1", reviewerId: "reviewer-2" } },
        create: expect.objectContaining({ reportId: "report-1", reviewerId: "reviewer-2" }),
      })
    );
  });

  it("is idempotent (upsert not insert)", async () => {
    await applyRecusal({ reportId: "r1", reviewerId: "rev1", actorReviewerId: "rev1" });
    await applyRecusal({ reportId: "r1", reviewerId: "rev1", actorReviewerId: "rev1" });
    expect(mockRecusalUpsert).toHaveBeenCalledTimes(2);
  });

  it("writes a recusal.applied audit log entry", async () => {
    mockLogEvent.mockClear();

    await applyRecusal({
      reportId: "report-99",
      reviewerId: "reviewer-5",
      actorReviewerId: "reviewer-5",
    });

    expect(mockLogEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "recusal.applied",
        reportId: "report-99",
      })
    );
  });
});

describe("getEligibleCommissionerCount()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns total commissioners minus recused ones", async () => {
    mockReviewerFindMany.mockResolvedValueOnce([
      { id: "c1" }, { id: "c2" }, { id: "c3" },
    ] as never);
    mockRecusalFindMany.mockResolvedValueOnce([{ reviewerId: "c2" }] as never);

    const count = await getEligibleCommissionerCount("report-1");
    expect(count).toBe(2);
  });

  it("returns 0 when all commissioners are recused", async () => {
    mockReviewerFindMany.mockResolvedValueOnce([{ id: "c1" }, { id: "c2" }] as never);
    mockRecusalFindMany.mockResolvedValueOnce([
      { reviewerId: "c1" }, { reviewerId: "c2" },
    ] as never);

    const count = await getEligibleCommissionerCount("report-2");
    expect(count).toBe(0);
  });

  it("returns full count when no recusals exist", async () => {
    mockReviewerFindMany.mockResolvedValueOnce([
      { id: "c1" }, { id: "c2" }, { id: "c3" }, { id: "c4" },
    ] as never);
    mockRecusalFindMany.mockResolvedValueOnce([] as never);

    const count = await getEligibleCommissionerCount("report-3");
    expect(count).toBe(4);
  });
});

describe("Recusal — query layer correctness", () => {
  it("recusalFilter structure prevents conflicted reviewers from seeing hidden cases", () => {
    const filter = recusalFilter("recused-reviewer-id");

    // recusals.none means: include only reports with NO recusal row for this reviewer
    expect(filter.recusals.none).toEqual({ reviewerId: "recused-reviewer-id" });
  });
});
