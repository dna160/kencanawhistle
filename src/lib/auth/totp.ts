/**
 * TOTP helpers using otplib.
 * Secrets are stored encrypted via the field-level encryption layer.
 */
import { authenticator } from "otplib";
import { encrypt, decrypt } from "@/lib/crypto";

/** Generate a new TOTP secret (plaintext). Encrypt before storing. */
export function generateTOTPSecret(): string {
  return authenticator.generateSecret(20); // 160-bit secret
}

/** Encrypt a TOTP secret for DB storage. */
export function encryptTOTPSecret(secret: string): string {
  return encrypt(secret);
}

/** Decrypt a TOTP secret retrieved from DB. */
export function decryptTOTPSecret(enc: string): string {
  return decrypt(enc);
}

/**
 * Generate a TOTP URI for QR code display.
 * @param email - Reviewer email (used as account label)
 * @param secret - Plaintext TOTP secret
 */
export function generateTOTPUri(email: string, secret: string): string {
  return authenticator.keyuri(
    email,
    process.env.TOTP_ISSUER ?? "Whistleblow",
    secret
  );
}

/**
 * Verify a 6-digit TOTP code against an encrypted stored secret.
 * Accepts current window ±1 to handle clock skew.
 */
export async function verifyTOTP(
  encryptedSecret: string,
  token: string
): Promise<boolean> {
  const secret = decryptTOTPSecret(encryptedSecret);
  authenticator.options = { window: 1 };
  return authenticator.verify({ token, secret });
}
