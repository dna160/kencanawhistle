import { auth } from "@/lib/auth/config";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="font-bold text-gray-900 text-lg">🔒 Speak Up</span>
          <nav className="flex gap-4 text-sm">
            <Link
              href="/cases"
              className="text-gray-600 hover:text-gray-900 font-medium"
            >
              Cases
            </Link>
            {session.user.role === "admin" && (
              <Link
                href="/admin"
                className="text-gray-600 hover:text-gray-900 font-medium"
              >
                Admin
              </Link>
            )}
          </nav>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{session.user.name ?? session.user.email}</span>
          <span className="bg-gray-100 px-2 py-1 rounded-lg text-xs font-medium capitalize">
            {session.user.role}
          </span>
          <Link href="/api/auth/signout" className="text-red-600 hover:text-red-700">
            Sign out
          </Link>
        </div>
      </header>

      <main className="flex-1 max-w-7xl mx-auto w-full px-6 py-8">
        {children}
      </main>
    </div>
  );
}
