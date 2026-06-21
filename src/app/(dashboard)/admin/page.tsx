import { requireRole } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { InviteForm } from "./InviteForm";
import type { ReviewerRole } from "@prisma/client";

const ROLE_LABELS: Record<ReviewerRole, string> = {
  commissioner: "Commissioner (Board member)",
  admin: "Administrator",
  external: "External escalation party",
};

export default async function AdminPage() {
  // Admin only — case access denied at RBAC layer
  await requireRole("admin");

  const users = await db.reviewer.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      email: true,
      displayName: true,
      role: true,
      isActive: true,
      totpVerified: true,
      createdAt: true,
      disabledAt: true,
    },
  });

  return (
    <div className="max-w-4xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-8">Administration</h1>

      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-8 text-sm text-amber-800">
        ⚠ As an administrator, you can manage user accounts and configuration, but you
        cannot view report contents or case details.
      </div>

      {/* User management */}
      <section className="bg-white rounded-2xl border p-6 mb-6">
        <h2 className="text-lg font-semibold mb-6">Users</h2>

        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Name</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Email</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Role</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">2FA</th>
                <th className="text-left px-4 py-3 font-semibold text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-800">{u.displayName}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                      {ROLE_LABELS[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.totpVerified ? (
                      <span className="text-xs text-green-700 font-medium">✓ Active</span>
                    ) : (
                      <span className="text-xs text-amber-600">Pending setup</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        u.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {u.isActive ? "Active" : "Disabled"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="border-t pt-6">
          <h3 className="text-base font-semibold mb-4">Invite New User</h3>
          <InviteForm />
        </div>
      </section>
    </div>
  );
}
