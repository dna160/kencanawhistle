/**
 * Post-login redirect — all roles go to /cases.
 * Admin can view cases for oversight/demo; /admin is accessible via nav.
 */
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function DashboardRootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  redirect("/cases");
}
