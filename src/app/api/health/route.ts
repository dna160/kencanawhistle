/**
 * Health-check endpoint for Railway and load-balancer monitoring.
 * Verifies DB connectivity.
 */
import { db } from "@/lib/db/client";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    await db.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok" }, { status: 200 });
  } catch {
    return NextResponse.json({ status: "error", detail: "db_unreachable" }, { status: 503 });
  }
}
