/**
 * Public endpoint — return active categories.
 * No authentication required.
 */
import { db } from "@/lib/db/client";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const categories = await db.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, key: true, labelEn: true, labelId: true },
  });
  return NextResponse.json(categories);
}
