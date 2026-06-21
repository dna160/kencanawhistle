"use client";

import { useState, FormEvent } from "react";
import type { ReportStatus, ReviewerRole } from "@prisma/client";
import { clsx } from "clsx";

const STATUS_TRANSITIONS: Record<ReportStatus, ReportStatus[]> = {
  new: ["acknowledged"],
  acknowledged: ["under_review"],
  under_review: ["action_taken", "escalated"],
  action_taken: ["closed"],
  closed: [],
  escalated: ["closed"],
};

const STATUS_LABELS: Record<ReportStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  under_review: "Under Review",
  action_taken: "Action Taken",
  closed: "Closed",
  escalated: "Escalated",
};

interface Props {
  reportId: string;
  referenceCode: string;
  currentStatus: ReportStatus;
  reviewerId: string;
  reviewerRole: ReviewerRole;
}

export function CaseActions({
  reportId,
  referenceCode,
  currentStatus,
  reviewerId,
  reviewerRole,
}: Props) {
  const [status, setStatus] = useState<ReportStatus>(currentStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Message to reporter
  const [message, setMessage] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);

  // Note
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  // Recusal
  const [recuseReason, setRecuseReason] = useState("");
  const [showRecuse, setShowRecuse] = useState(false);

  const nextStatuses = STATUS_TRANSITIONS[status];

  const changeStatus = async (newStatus: ReportStatus) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Status change failed");
      setStatus(newStatus);
      setSuccess(`Status updated to: ${STATUS_LABELS[newStatus]}`);
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to update status.");
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async (e: FormEvent) => {
    e.preventDefault();
    setSendingMsg(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${reportId}/message`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: message }),
      });
      if (!res.ok) throw new Error();
      setMessage("");
      setSuccess("Message sent to reporter.");
      setTimeout(() => setSuccess(null), 3000);
    } catch {
      setError("Failed to send message.");
    } finally {
      setSendingMsg(false);
    }
  };

  const saveNote = async (e: FormEvent) => {
    e.preventDefault();
    setSavingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${reportId}/note`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: note }),
      });
      if (!res.ok) throw new Error();
      setNote("");
      setSuccess("Note saved.");
      setTimeout(() => setSuccess(null), 3000);
      // Reload page to show new note
      window.location.reload();
    } catch {
      setError("Failed to save note.");
    } finally {
      setSavingNote(false);
    }
  };

  const applyRecusal = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/cases/${reportId}/recuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: recuseReason }),
      });
      if (!res.ok) throw new Error();
      // Redirect away from this case — reviewer can no longer see it
      window.location.href = "/cases";
    } catch {
      setError("Failed to apply recusal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status transitions */}
      {nextStatuses.length > 0 && (
        <section className="bg-white rounded-2xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Update Status</h3>
          <div className="space-y-2">
            {nextStatuses.map((s) => (
              <button
                key={s}
                onClick={() => changeStatus(s)}
                disabled={loading}
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 text-left"
              >
                → {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </section>
      )}

      {/* Message to reporter */}
      {status !== "closed" && (
        <section className="bg-white rounded-2xl border p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Message Reporter</h3>
          <form onSubmit={sendMessage} className="space-y-3">
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Ask a follow-up question…"
              rows={3}
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-y"
            />
            <button
              type="submit"
              disabled={sendingMsg || !message.trim()}
              className="w-full bg-brand-600 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
            >
              {sendingMsg ? "Sending…" : "Send message"}
            </button>
          </form>
        </section>
      )}

      {/* Internal note */}
      <section className="bg-white rounded-2xl border p-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Add Internal Note</h3>
        <form onSubmit={saveNote} className="space-y-3">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Internal notes (only visible to reviewers)…"
            rows={3}
            className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm resize-y"
          />
          <button
            type="submit"
            disabled={savingNote || !note.trim()}
            className="w-full bg-gray-800 text-white rounded-xl py-2.5 text-sm font-semibold hover:bg-gray-900 disabled:opacity-60"
          >
            {savingNote ? "Saving…" : "Save note"}
          </button>
        </form>
      </section>

      {/* Recusal */}
      {reviewerRole === "commissioner" && (
        <section className="bg-white rounded-2xl border border-orange-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Recuse Myself</h3>
          {!showRecuse ? (
            <button
              onClick={() => setShowRecuse(true)}
              className="w-full rounded-xl border border-orange-300 px-4 py-2.5 text-sm font-medium text-orange-700 hover:bg-orange-50"
            >
              I have a conflict of interest
            </button>
          ) : (
            <div className="space-y-3">
              <p className="text-xs text-orange-700">
                You will no longer be able to see this case after confirming.
              </p>
              <textarea
                value={recuseReason}
                onChange={(e) => setRecuseReason(e.target.value)}
                placeholder="Reason (optional)"
                rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
              />
              <div className="flex gap-2">
                <button
                  onClick={applyRecusal}
                  disabled={loading}
                  className="flex-1 bg-orange-600 text-white rounded-xl py-2 text-sm font-semibold hover:bg-orange-700 disabled:opacity-60"
                >
                  Confirm recusal
                </button>
                <button
                  onClick={() => setShowRecuse(false)}
                  className="px-4 text-sm text-gray-600 hover:text-gray-900"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Feedback */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-sm text-green-700">
          {success}
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
          {error}
        </div>
      )}
    </div>
  );
}
