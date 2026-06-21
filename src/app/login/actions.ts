"use server";

import { signIn } from "@/lib/auth/config";
import { AuthError } from "next-auth";

export async function loginAction(data: {
  email: string;
  password: string;
  totpCode: string;
}): Promise<{ error: string } | undefined> {
  try {
    await signIn("credentials", {
      email: data.email,
      password: data.password,
      totpCode: data.totpCode || "",
      redirectTo: "/dashboard",
    });
    // signIn with redirectTo throws a NEXT_REDIRECT on success —
    // if we get here, it somehow didn't redirect (shouldn't happen)
    return undefined;
  } catch (error) {
    // Re-throw Next.js redirect (this is how next-auth v5 signals success)
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) {
      throw error;
    }
    // Auth errors (wrong credentials, TOTP fail, etc.)
    if (error instanceof AuthError) {
      return { error: "Invalid credentials or 2FA code. Please check and try again." };
    }
    // Unexpected
    console.error("[login] unexpected error:", error);
    return { error: "Something went wrong. Please try again." };
  }
}
