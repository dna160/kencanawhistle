/**
 * Anonymity tests for the report submission route.
 *
 * These tests assert the TECHNICAL anonymity guarantees documented in §5 and §6.1:
 * - No IP address is read or stored
 * - No device fingerprint is stored
 * - Access code is stored only as a hash, never plaintext
 * - Named-mode identity is encrypted, not plaintext
 * - EXIF metadata is stripped from image uploads
 */

import { describe, it, expect, beforeEach, jest } from "@jest/globals";

// ── Mock nanoid (ESM module — must mock before any imports that use it) ──────
jest.mock("nanoid", () => ({
  nanoid: () => "ABC123",
  customAlphabet: () => () => "TESTCODE1234ABCD",
}));

// ── Mock DB ───────────────────────────────────────────────────────────────────
const mockCreate = jest.fn().mockResolvedValue({
  id: "report-id-1",
  referenceCode: "WB-ABC123",
  isAnonymous: true,
} as never);

const mockFindUnique = jest.fn().mockResolvedValue({
  id: "cat-1",
  key: "fraud",
  isActive: true,
} as never);

const mockAttachCreate = jest.fn().mockResolvedValue({} as never);

jest.mock("@/lib/db/client", () => ({
  db: {
    category: { findUnique: mockFindUnique },
    report: { create: mockCreate },
    attachment: { create: mockAttachCreate },
    auditLog: { create: jest.fn().mockResolvedValue({} as never) },
  },
}));

// ── Mock crypto ───────────────────────────────────────────────────────────────
jest.mock("@/lib/crypto", () => ({
  generateAccessCode: () => "TESTCODE1234ABCD",
  hashAccessCode: async (code: string) => `hash_of_${code}`,
  verifyAccessCode: async (code: string, hash: string) => hash === `hash_of_${code}`,
  encrypt: (plaintext: string) => `encrypted:${plaintext}`,
  decrypt: (ciphertext: string) => ciphertext.replace("encrypted:", ""),
}));

// ── Mock file sanitizer ───────────────────────────────────────────────────────
jest.mock("@/lib/files/sanitize", () => ({
  sanitizeUpload: jest.fn().mockResolvedValue({
    buffer: Buffer.from("stripped"),
    mime: "image/jpeg",
    sizeBytes: 7,
    metadataStripped: true,
    safeFilename: "photo.jpg",
  } as never),
  ALLOWED_MIME_TYPES: new Set(["image/jpeg"]),
  MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
}));

import { POST } from "@/app/api/reports/route";
import { NextRequest } from "next/server";

function makeRequest(fields: Record<string, string>, files?: File[]): NextRequest {
  const formData = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    formData.append(k, v);
  }
  if (files) {
    for (const f of files) formData.append("attachments", f);
  }

  return new NextRequest("http://localhost/api/reports", {
    method: "POST",
    body: formData,
    // NOTE: No IP set anywhere in this request — mirroring the real constraint
  });
}

describe("POST /api/reports — anonymity guarantees", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 201 with accessCode and referenceCode", async () => {
    const req = makeRequest({
      mode: "anonymous",
      categoryKey: "fraud",
      description: "I witnessed funds being diverted from the budget to a personal account over three months.",
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("accessCode");
    expect(body).toHaveProperty("referenceCode");
    expect(body.accessCode).toBe("TESTCODE1234ABCD");
  });

  it("NEVER stores IP address in the report.create call", async () => {
    const req = makeRequest({
      mode: "anonymous",
      categoryKey: "fraud",
      description: "Test description long enough to pass validation minimum length.",
    });
    await POST(req);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    const createArg = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    const reportData = createArg.data;

    // These fields must NEVER appear in the create payload
    expect(reportData).not.toHaveProperty("ipAddress");
    expect(reportData).not.toHaveProperty("ip");
    expect(reportData).not.toHaveProperty("userAgent");
    expect(reportData).not.toHaveProperty("deviceId");
    expect(reportData).not.toHaveProperty("fingerprint");
  });

  it("stores body as encrypted ciphertext, not plaintext (passes through encrypt())", async () => {
    const req = makeRequest({
      mode: "anonymous",
      categoryKey: "fraud",
      description: "Sensitive whistleblower description of misconduct.",
    });
    await POST(req);
    const createArg = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    const bodyEnc = createArg.data.bodyEnc as string;

    // The mock encrypt() returns "encrypted:<plaintext>" — the important assertion is:
    // (a) the field went through encrypt() (starts with "encrypted:")
    // (b) the stored value is NOT the raw description string — it must be JSON-wrapped and encrypted
    expect(bodyEnc).toMatch(/^encrypted:/);
    // The raw description string alone must not be stored directly (it's JSON-encoded then encrypted)
    expect(bodyEnc).not.toBe("Sensitive whistleblower description of misconduct.");
  });

  it("stores access code as hash, never plaintext in the DB", async () => {
    const req = makeRequest({
      mode: "anonymous",
      categoryKey: "fraud",
      description: "Test description that is long enough to meet the minimum character limit.",
    });
    await POST(req);
    const createArg = mockCreate.mock.calls[0][0] as { data: { accessCodes?: { create: { codeHash: string } } } };
    const codeHash = createArg.data?.accessCodes?.create?.codeHash;

    // Must be a hash, not the plaintext code
    expect(codeHash).toBe("hash_of_TESTCODE1234ABCD");
    expect(codeHash).not.toBe("TESTCODE1234ABCD");
  });

  it("encrypts named-mode identity before storage", async () => {
    const req = makeRequest({
      mode: "named",
      categoryKey: "fraud",
      description: "Named report — description must be long enough to pass validation.",
      consent: "on",
      reporterName: "Budi Santoso",
      reporterContact: "budi@example.com",
    });
    await POST(req);
    const createArg = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    const identityEnc = createArg.data.consentedIdentityEnc as string;

    // The mock encrypt() returns "encrypted:<plaintext>"; the key assertion is:
    // (a) identity went through encrypt() rather than being stored as raw strings
    expect(identityEnc).toMatch(/^encrypted:/);
    // (b) the field is not the raw name or contact stored directly
    expect(identityEnc).not.toBe("Budi Santoso");
    expect(identityEnc).not.toBe("budi@example.com");
  });

  it("rejects named mode without consent checkbox", async () => {
    const req = makeRequest({
      mode: "named",
      categoryKey: "fraud",
      description: "Report without consent checkbox checked for named submission.",
      // consent field omitted
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });

  it("marks anonymous report with isAnonymous=true", async () => {
    const req = makeRequest({
      mode: "anonymous",
      categoryKey: "fraud",
      description: "Anonymous report — should set isAnonymous flag to true in DB.",
    });
    await POST(req);
    const createArg = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.isAnonymous).toBe(true);
  });

  it("marks named report with isAnonymous=false", async () => {
    const req = makeRequest({
      mode: "named",
      categoryKey: "fraud",
      description: "Named report — should set isAnonymous flag to false in the database.",
      consent: "on",
    });
    await POST(req);
    const createArg = mockCreate.mock.calls[0][0] as { data: Record<string, unknown> };
    expect(createArg.data.isAnonymous).toBe(false);
  });

  it("rejects description shorter than 20 characters", async () => {
    const req = makeRequest({
      mode: "anonymous",
      categoryKey: "fraud",
      description: "Too short",
    });
    const res = await POST(req);
    expect(res.status).toBe(422);
  });
});

describe("POST /api/reports — EXIF metadata stripping", () => {
  it("sanitizeUpload is called for every attached file", async () => {
    const { sanitizeUpload } = await import("@/lib/files/sanitize");
    const mockSanitize = sanitizeUpload as jest.MockedFunction<typeof sanitizeUpload>;
    mockSanitize.mockClear();

    // Create a fake image file
    const fakeImage = new File(["fake-image-data"], "photo.jpg", { type: "image/jpeg" });

    const req = makeRequest(
      {
        mode: "anonymous",
        categoryKey: "fraud",
        description: "Report with attachment — EXIF must be stripped before storage.",
      },
      [fakeImage]
    );
    await POST(req);

    expect(mockSanitize).toHaveBeenCalledTimes(1);
    const [, mime, filename] = mockSanitize.mock.calls[0] as [Buffer, string, string];
    expect(mime).toBe("image/jpeg");
    expect(filename).toBe("photo.jpg");
  });
});
