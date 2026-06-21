import { requireCaseAccess } from "@/lib/auth/rbac";
import { db } from "@/lib/db/client";
import { recusalFilter } from "@/lib/recusal";
import { decrypt } from "@/lib/crypto";
import { logEvent } from "@/lib/audit";
import { notFound } from "next/navigation";
import { CaseActions } from "./CaseActions";
import { clsx } from "clsx";
import type { ReportStatus } from "@prisma/client";

const STATUS_LABELS: Record<ReportStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  under_review: "Under Review",
  action_taken: "Action Taken",
  closed: "Closed",
  escalated: "Escalated",
};

export default async function CaseDetailPage({
  params,
}: {
  params: Promise<{ ref: string }>;
}) {
  const reviewer = await requireCaseAccess();
  const { ref } = await params;

  // Enforce recusal at the query layer
  const report = await db.report.findFirst({
    where: {
      referenceCode: ref,
      ...recusalFilter(reviewer.reviewerId),
    },
    include: {
      category: true,
      messages: { orderBy: { createdAt: "asc" } },
      notes: {
        include: { author: { select: { displayName: true } } },
        orderBy: { createdAt: "asc" },
      },
      attachments: true,
      recusals: { include: { reviewer: { select: { displayName: true } } } },
      escalations: { include: { toReviewer: { select: { displayName: true, email: true } } } },
    },
  });

  if (!report) notFound();

  // Audit log: report viewed
  await logEvent({
    action: "report.viewed",
    actorReviewerId: reviewer.reviewerId,
    reportId: report.id,
  });

  // Decrypt body
  let bodyData: { description: string; subject?: string; incidentDate?: string; location?: string } | null = null;
  try {
    bodyData = JSON.parse(decrypt(report.bodyEnc));
  } catch {
    bodyData = { description: "[Decryption failed]" };
  }

  // Decrypt messages
  const messages = report.messages.map((m) => ({
    ...m,
    body: decrypt(m.bodyEnc),
  }));

  // Decrypt notes
  const notes = report.notes.map((n) => ({
    ...n,
    body: decrypt(n.bodyEnc),
  }));

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <a href="/cases" className="text-sm text-gray-400 hover:text-gray-600">
              ← Cases
            </a>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{report.referenceCode}</h1>
          <p className="text-gray-500 text-sm mt-1">
            {report.category.labelEn} · Submitted {report.createdAt.toLocaleDateString()}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={clsx(
            "px-3 py-1 rounded-full text-sm font-semibold",
            report.status === "new" ? "bg-blue-100 text-blue-800" :
            report.status === "acknowledged" ? "bg-yellow-100 text-yellow-800" :
            report.status === "under_review" ? "bg-purple-100 text-purple-800" :
            report.status === "action_taken" ? "bg-orange-100 text-orange-800" :
            report.status === "closed" ? "bg-green-100 text-green-800" :
            "bg-red-100 text-red-800"
          )}>
            {STATUS_LABELS[report.status]}
          </span>
          <span className={clsx(
            "text-xs px-2 py-1 rounded-full",
            report.isAnonymous ? "bg-gray-100 text-gray-500" : "bg-blue-100 text-blue-600"
          )}>
            {report.isAnonymous ? "Anonymous" : "Named (consented)"}
          </span>
        </div>
      </div>

      {/* Commissioner flag */}
      {report.subjectIsCommissioner && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-4 mb-6 text-sm text-orange-800">
          ⚠ This report concerns a member of the Board of Commissioners.
          {report.recusals.length > 0 && (
            <span className="block mt-1 text-xs">
              Recused: {report.recusals.map((r) => r.reviewer.displayName).join(", ")}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Report body */}
          <section className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Report Details</h2>
            <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
              {bodyData?.description}
            </p>
            {bodyData?.subject && (
              <div className="mt-4 pt-4 border-t text-sm">
                <span className="font-medium text-gray-600">Subject / Department: </span>
                <span className="text-gray-700">{bodyData.subject}</span>
              </div>
            )}
            {bodyData?.incidentDate && (
              <div className="mt-2 text-sm">
                <span className="font-medium text-gray-600">Date: </span>
                <span className="text-gray-700">{bodyData.incidentDate}</span>
              </div>
            )}
            {bodyData?.location && (
              <div className="mt-2 text-sm">
                <span className="font-medium text-gray-600">Location: </span>
                <span className="text-gray-700">{bodyData.location}</span>
              </div>
            )}
          </section>

          {/* Attachments */}
          {report.attachments.length > 0 && (
            <section className="bg-white rounded-2xl border p-6">
              <h2 className="font-semibold text-gray-800 mb-4">Attachments</h2>
              <ul className="space-y-2">
                {report.attachments.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 text-sm">
                    <span className="text-gray-400">📎</span>
                    <span className="text-gray-700">{a.filename}</span>
                    <span className="text-gray-400 text-xs">
                      {(a.sizeBytes / 1024).toFixed(1)} KB
                    </span>
                    {a.metadataStripped && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                        metadata stripped
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Message thread */}
          <section className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">Reporter Messages</h2>
            <div className="space-y-4">
              {messages.length === 0 && (
                <p className="text-sm text-gray-400 italic">No messages yet.</p>
              )}
              {messages.map((m) => (
                <div
                  key={m.id}
                  className={clsx(
                    "rounded-xl p-4",
                    m.sender === "reporter" ? "bg-gray-50" : "bg-brand-50 ml-4"
                  )}
                >
                  <p className="text-xs font-semibold text-gray-500 mb-1">
                    {m.sender === "reporter" ? "Reporter" : "Reviewer"}
                    <span className="ml-2 font-normal text-gray-400">
                      {m.createdAt.toLocaleString()}
                    </span>
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{m.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Internal notes */}
          <section className="bg-white rounded-2xl border p-6">
            <h2 className="font-semibold text-gray-800 mb-4">
              Internal Notes
              <span className="ml-2 text-xs font-normal text-gray-400">
                (not visible to reporter)
              </span>
            </h2>
            <div className="space-y-3">
              {notes.map((n) => (
                <div key={n.id} className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
                  <p className="text-xs text-gray-500 mb-1">
                    {n.author.displayName} · {n.createdAt.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{n.body}</p>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Sidebar: actions */}
        <div className="space-y-4">
          <CaseActions
            reportId={report.id}
            referenceCode={report.referenceCode}
            currentStatus={report.status}
            reviewerId={reviewer.reviewerId}
            reviewerRole={reviewer.role}
          />
        </div>
      </div>
    </div>
  );
}
