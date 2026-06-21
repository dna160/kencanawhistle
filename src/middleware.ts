/**
 * Next.js middleware — protect all /cases, /case, and /admin routes.
 * Reporter routes (/ and /follow-up) are public.
 */
import { auth } from "@/lib/auth/config";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Public paths — no auth required
  const publicPaths = ["/", "/follow-up", "/login", "/api/reports", "/api/categories", "/api/health"];
  if (publicPaths.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  // All other paths require authentication
  const session = await auth();
  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin RBAC: /admin routes are for admin role only
  if (pathname.startsWith("/admin") && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // /api/admin routes: admin only
  if (pathname.startsWith("/api/admin") && session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
