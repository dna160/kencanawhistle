/**
 * Cryptographic utilities
 *
 * - Access code generation + argon2 hashing
 * - Field-level AES-256-GCM encryption / decryption
 *   (enabled when ENCRYPTION_KEY env var is set)
 */
import argon2 from "argon2";
import { randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { customAlphabet } from "nanoid";

// ─────────────────────────────────────────────
// Access codes
// ─────────────────────────────────────────────

// Human-friendly alphabet: no 0/O/I/l confusion
const ACCESS_CODE_ALPHABET =
  "23456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz";
const nanoid = customAlphabet(ACCESS_CODE_ALPHABET, 16);

/**
 * Generate a one-time access code (passphrase-style, 16 chars).
 * Returns plaintext — caller must display once and hash for storage.
 */
export function generateAccessCode(): string {
  return nanoid();
}

/**
 * Hash an access code for storage using argon2id.
 */
export async function hashAccessCode(code: string): Promise<string> {
  return argon2.hash(code, { type: argon2.argon2id });
}

/**
 * Verify a provided code against its stored hash.
 */
export async function verifyAccessCode(
  code: string,
  hash: string
): Promise<boolean> {
  return argon2.verify(hash, code);
}

// ─────────────────────────────────────────────
// Field-level encryption (AES-256-GCM)
// ─────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV recommended for GCM
const TAG_LENGTH = 16; // 128-bit auth tag

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    // Return a zero-key in dev when not set — field encryption is a no-op
    if (process.env.NODE_ENV !== "production") {
      return Buffer.alloc(32, 0);
    }
    throw new Error("ENCRYPTION_KEY env var is required in production");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("ENCRYPTION_KEY must be 32 bytes (base64-encoded)");
  }
  return key;
}

/**
 * Encrypt plaintext using AES-256-GCM.
 * Returns a base64 string: iv (12 bytes) + tag (16 bytes) + ciphertext.
 * If ENCRYPTION_KEY is not set in development, returns plaintext prefixed "plain:".
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  if (key.equals(Buffer.alloc(32, 0))) {
    // Dev no-op: store as "plain:<value>" so tests can detect misconfiguration
    return `plain:${plaintext}`;
  }
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Decrypt a value produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  if (ciphertext.startsWith("plain:")) {
    return ciphertext.slice(6);
  }
  const key = getKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
