/**
 * Smart redirect: sends each role to the right landing page.
 * Admin → /admin, Commissioner/External → /cases
 */
import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";

export default async function DashboardRootPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  if (session.user.role === "admin") {
    redirect("/admin");
  }
  redirect("/cases");
}
