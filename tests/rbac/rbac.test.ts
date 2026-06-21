/**
 * RBAC tests.
 *
 * Verifies that admin role cannot access case content and
 * that role guards work correctly.
 */
import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import { ForbiddenError } from "@/lib/auth/rbac";

// Mock next-auth
jest.mock("@/lib/auth/config", () => ({
  auth: jest.fn(),
}));

// Mock next/navigation
jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

import { auth } from "@/lib/auth/config";
import { requireRole, requireCaseAccess } from "@/lib/auth/rbac";

const mockAuth = auth as jest.MockedFunction<typeof auth>;

function makeSession(role: "commissioner" | "admin" | "external") {
  return {
    user: {
      reviewerId: "reviewer-1",
      email: "test@example.com",
      name: "Test User",
      role,
    },
    expires: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
  } as never;
}

describe("requireRole()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows commissioner role when commissioner is required", async () => {
    mockAuth.mockResolvedValue(makeSession("commissioner"));
    await expect(requireRole("commissioner")).resolves.toMatchObject({ role: "commissioner" });
  });

  it("throws ForbiddenError when admin tries to access commissioner-only route", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"));
    await expect(requireRole("commissioner")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("throws ForbiddenError when external tries to access admin-only route", async () => {
    mockAuth.mockResolvedValue(makeSession("external"));
    await expect(requireRole("admin")).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allows admin role for admin-only routes", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"));
    await expect(requireRole("admin")).resolves.toMatchObject({ role: "admin" });
  });
});

describe("requireCaseAccess()", () => {
  beforeEach(() => jest.clearAllMocks());

  it("allows commissioner to access cases", async () => {
    mockAuth.mockResolvedValue(makeSession("commissioner"));
    await expect(requireCaseAccess()).resolves.toMatchObject({ role: "commissioner" });
  });

  it("allows external party to access escalated cases", async () => {
    mockAuth.mockResolvedValue(makeSession("external"));
    await expect(requireCaseAccess()).resolves.toMatchObject({ role: "external" });
  });

  it("DENIES admin role from case access", async () => {
    mockAuth.mockResolvedValue(makeSession("admin"));
    await expect(requireCaseAccess()).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe("ForbiddenError", () => {
  it("has status 403", () => {
    const err = new ForbiddenError();
    expect(err.status).toBe(403);
    expect(err.name).toBe("ForbiddenError");
  });
});
