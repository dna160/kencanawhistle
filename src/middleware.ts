/**
 * Next.js middleware — protect all /cases, /case, and /admin routes.
 * Reporter routes (/ and /follow-up) are public.
 *
 * Uses getToken() from next-auth/jwt (Edge-compatible) rather than importing
 * the full auth config, which pulls in argon2 → node:crypto and breaks the
 * Edge runtime used by middleware.
 */
import { getToken } from "next-auth/jwt";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Paths that require NO authentication
const PUBLIC_PREFIXES = [
  "/",
  "/follow-up",
  "/login",
  "/api/reports",
  "/api/categories",
  "/api/health",
  "/api/auth",
  "/_next",
  "/favicon.ico",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublic(pathname)) return NextResponse.next();

  // Verify JWT session (Edge-safe — no argon2, no node:crypto)
  const token = await getToken({
    req,
    secret: process.env.AUTH_SECRET,
  });

  if (!token) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin role check: /admin and /api/admin routes are admin-only
  if (
    (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) &&
    token.role !== "admin"
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match everything except Next.js internals and static assets
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
