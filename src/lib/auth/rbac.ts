/**
 * Role-Based Access Control guards.
 *
 * Roles:
 *   commissioner — Board member; can read/act on cases (subject to recusal)
 *   admin        — System admin; manages users/config; CANNOT read cases
 *   external     — External escalation party; sees only escalated cases
 *
 * These guards are used in API route handlers and Server Components.
 */
import { auth } from "@/lib/auth/config";
import type { ReviewerRole } from "@prisma/client";
import { redirect } from "next/navigation";

export interface AuthenticatedReviewer {
  reviewerId: string;
  email: string;
  name: string | null | undefined;
  role: ReviewerRole;
}

/**
 * Require an authenticated session. Redirects to /login if not authenticated.
 */
export async function requireAuth(): Promise<AuthenticatedReviewer> {
  const session = await auth();
  if (!session?.user?.reviewerId) {
    redirect("/login");
  }
  return {
    reviewerId: session.user.reviewerId,
    email: session.user.email!,
    name: session.user.name,
    role: session.user.role,
  };
}

/**
 * Require a specific role. Throws 403 if role doesn't match.
 */
export async function requireRole(
  ...allowedRoles: ReviewerRole[]
): Promise<AuthenticatedReviewer> {
  const reviewer = await requireAuth();
  if (!allowedRoles.includes(reviewer.role)) {
    throw new ForbiddenError(
      `Role '${reviewer.role}' is not permitted. Required: ${allowedRoles.join(" | ")}`
    );
  }
  return reviewer;
}

/**
 * Require case-access permission (commissioner or external).
 * Admin is explicitly denied.
 */
export async function requireCaseAccess(): Promise<AuthenticatedReviewer> {
  return requireRole("commissioner", "external");
}

export class ForbiddenError extends Error {
  readonly status = 403;
  constructor(message = "Forbidden") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/** Helper: return 403 JSON response for API routes */
export function forbidden(message = "Forbidden") {
  return Response.json({ error: message }, { status: 403 });
}

/** Helper: return 401 JSON response for API routes */
export function unauthorized(message = "Unauthorized") {
  return Response.json({ error: message }, { status: 401 });
}
