import { requireCaseAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { recusalFilter } from "@/lib/recusal";
import { logEvent } from "@/lib/audit";
import Link from "next/link";
import { clsx } from "clsx";
import type { ReportStatus } from "@prisma/client";

const STATUS_COLORS: Record<ReportStatus, string> = {
  new: "bg-blue-100 text-blue-800",
  acknowledged: "bg-yellow-100 text-yellow-800",
  under_review: "bg-purple-100 text-purple-800",
  action_taken: "bg-orange-100 text-orange-800",
  closed: "bg-green-100 text-green-800",
  escalated: "bg-red-100 text-red-800",
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  under_review: "Under Review",
  action_taken: "Action Taken",
  closed: "Closed",
  escalated: "Escalated",
};

// SLA targets
const SLA_ACKNOWLEDGE_DAYS = 7;
const SLA_FEEDBACK_DAYS = 90;

function slaStatus(createdAt: Date, status: ReportStatus): {
  label: string;
  color: string;
} {
  if (status === "closed" || status === "action_taken") {
    return { label: "Closed", color: "text-green-600" };
  }
  const now = Date.now();
  const ageDays = (now - createdAt.getTime()) / (1000 * 60 * 60 * 24);

  if (status === "new" && ageDays > SLA_ACKNOWLEDGE_DAYS) {
    return { label: "⚠ Acknowledge overdue", color: "text-red-600 font-semibold" };
  }
  if (ageDays > SLA_FEEDBACK_DAYS) {
    return { label: "⚠ Feedback overdue", color: "text-red-600 font-semibold" };
  }
  if (status === "new") {
    const daysLeft = SLA_ACKNOWLEDGE_DAYS - Math.floor(ageDays);
    return { label: `Acknowledge in ${daysLeft}d`, color: "text-amber-600" };
  }
  const feedbackLeft = SLA_FEEDBACK_DAYS - Math.floor(ageDays);
  return { label: `Feedback in ${feedbackLeft}d`, color: "text-gray-500" };
}

export default async function CasesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const reviewer = await requireCaseAccess();
  const params = await searchParams;
  const statusFilter = params.status as ReportStatus | undefined;

  const cases = await db.report.findMany({
    where: {
      ...recusalFilter(reviewer.reviewerId),
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: { category: true },
    orderBy: { createdAt: "desc" },
  });

  const statusCounts = await db.report.groupBy({
    by: ["status"],
    where: recusalFilter(reviewer.reviewerId),
    _count: { status: true },
  });
  const counts = Object.fromEntries(
    statusCounts.map((s) => [s.status, s._count.status])
  );

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Cases</h1>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <FilterTab href="/cases" active={!statusFilter} label="All" count={Object.values(counts).reduce((a, b) => a + b, 0)} />
        {(Object.keys(STATUS_LABELS) as ReportStatus[]).map((s) => (
          <FilterTab
            key={s}
            href={`/cases?status=${s}`}
            active={statusFilter === s}
            label={STATUS_LABELS[s]}
            count={counts[s] ?? 0}
          />
        ))}
      </div>

      {/* Case table */}
      {cases.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          No cases match your filters.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Reference</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Category</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Status</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Submitted</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">SLA</th>
                <th className="text-left px-6 py-3 font-semibold text-gray-600">Type</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {cases.map((c) => {
                const sla = slaStatus(c.createdAt, c.status);
                return (
                  <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4">
                      <Link
                        href={`/case/${c.referenceCode}`}
                        className="font-mono font-semibold text-brand-600 hover:underline"
                      >
                        {c.referenceCode}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-gray-700">{c.category.labelEn}</td>
                    <td className="px-6 py-4">
                      <span className={clsx("px-2 py-1 rounded-full text-xs font-semibold", STATUS_COLORS[c.status])}>
                        {STATUS_LABELS[c.status]}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-gray-500">
                      {c.createdAt.toLocaleDateString()}
                    </td>
                    <td className={clsx("px-6 py-4 text-xs", sla.color)}>
                      {sla.label}
                    </td>
                    <td className="px-6 py-4">
                      <span className={clsx(
                        "text-xs px-2 py-1 rounded-full font-medium",
                        c.isAnonymous ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"
                      )}>
                        {c.isAnonymous ? "Anonymous" : "Named"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FilterTab({
  href,
  active,
  label,
  count,
}: {
  href: string;
  active: boolean;
  label: string;
  count: number;
}) {
  return (
    <Link
      href={href}
      className={clsx(
        "px-4 py-2 rounded-xl text-sm font-medium transition-colors flex items-center gap-2",
        active
          ? "bg-brand-600 text-white"
          : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
      )}
    >
      {label}
      <span className={clsx(
        "text-xs px-1.5 py-0.5 rounded-full",
        active ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"
      )}>
        {count}
      </span>
    </Link>
  );
}
