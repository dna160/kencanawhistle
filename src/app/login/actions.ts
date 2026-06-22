"use server";

import { signIn } from "@/lib/auth/config";
import { AuthError } from "next-auth";

/**
 * Server Action for login — used as a form action via useActionState.
 * Returns an error string on failure, or redirects (throws NEXT_REDIRECT) on success.
 */
export async function loginAction(
  _prevState: string | null,
  formData: FormData
): Promise<string | null> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const totpCode = (formData.get("totpCode") as string) || "";

  try {
    await signIn("credentials", {
      email,
      password,
      totpCode,
      redirectTo: "/dashboard",
    });
    // signIn with redirectTo always throws NEXT_REDIRECT on success;
    // if we somehow reach here, return null (no error)
    return null;
  } catch (error) {
    // NEXT_REDIRECT must be re-thrown so Next.js can send the 303 to the browser
    const digest = (error as { digest?: string })?.digest ?? "";
    if (digest.startsWith("NEXT_REDIRECT")) throw error;

    if (error instanceof AuthError) {
      return "Invalid credentials or 2FA code. Please try again.";
    }

    console.error("[login] unexpected error:", error);
    return "Something went wrong. Please try again.";
  }
}
