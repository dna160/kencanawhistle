"use client";

import { useState, FormEvent } from "react";
import { useTranslations } from "next-intl";
import { clsx } from "clsx";

interface ThreadMessage {
  id: string;
  sender: "reporter" | "reviewer";
  body: string;
  createdAt: string;
}

interface ReportThread {
  referenceCode: string;
  status: string;
  category: { labelEn: string; labelId: string };
  messages: ThreadMessage[];
}

export default function FollowUpPage() {
  const t = useTranslations("accessCode");
  const ts = useTranslations("status");
  const tt = useTranslations("thread");
  const te = useTranslations("errors");

  const [code, setCode] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [thread, setThread] = useState<ReportThread | null>(null);
  const [sessionCode, setSessionCode] = useState<string>("");

  const [newMessage, setNewMessage] = useState("");
  const [sending, setSending] = useState(false);

  const handleLookup = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setChecking(true);
    try {
      const res = await fetch("/api/reports/follow-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: code }),
      });
      if (res.status === 429) { setError(te("tooManyRequests")); return; }
      if (res.status === 404 || res.status === 401) { setError(t("invalidCode")); return; }
      if (!res.ok) { setError(te("generic")); return; }
      const data = await res.json();
      setThread(data);
      setSessionCode(code);
    } catch {
      setError(te("generic"));
    } finally {
      setChecking(false);
    }
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !thread) return;
    setSending(true);
    try {
      const res = await fetch("/api/reports/follow-up/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accessCode: sessionCode, body: newMessage }),
      });
      if (!res.ok) { setError(te("generic")); return; }
      const msg = await res.json();
      setThread((prev) =>
        prev ? { ...prev, messages: [...prev.messages, msg] } : prev
      );
      setNewMessage("");
    } catch {
      setError(te("generic"));
    } finally {
      setSending(false);
    }
  };

  // ── Thread view ────────────────────────────────────────────────────────────
  if (thread) {
    return (
      <main className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-bold">{tt("title")}</h1>
            <p className="text-sm text-gray-500">
              {thread.referenceCode} · {thread.category.labelEn}
            </p>
          </div>
          <span
            className={clsx(
              "px-3 py-1 rounded-full text-xs font-semibold",
              thread.status === "closed" || thread.status === "action_taken"
                ? "bg-green-100 text-green-800"
                : thread.status === "escalated"
                ? "bg-orange-100 text-orange-800"
                : "bg-blue-100 text-blue-800"
            )}
          >
            {ts(thread.status as Parameters<typeof ts>[0])}
          </span>
        </div>

        {/* Message thread */}
        <div className="space-y-4">
          {thread.messages.length === 0 && (
            <p className="text-sm text-gray-400 italic">{tt("noMessages")}</p>
          )}
          {thread.messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                "rounded-xl p-4 max-w-prose",
                msg.sender === "reporter"
                  ? "bg-brand-50 ml-auto text-right"
                  : "bg-gray-100"
              )}
            >
              <p className="text-xs text-gray-500 mb-1 font-medium">
                {msg.sender === "reporter" ? tt("reporterLabel") : tt("reviewerLabel")}
              </p>
              <p className="text-sm whitespace-pre-wrap">{msg.body}</p>
              <p className="text-xs text-gray-400 mt-1">
                {new Date(msg.createdAt).toLocaleString()}
              </p>
            </div>
          ))}
        </div>

        {/* Reply form */}
        {thread.status !== "closed" && (
          <form onSubmit={handleSendMessage} className="space-y-3">
            <textarea
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={4}
              placeholder={tt("messagePlaceholder")}
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base resize-y"
            />
            {error && (
              <p className="text-sm text-red-600">{error}</p>
            )}
            <button
              type="submit"
              disabled={sending || !newMessage.trim()}
              className="bg-brand-600 text-white rounded-xl px-6 py-3 font-semibold hover:bg-brand-700 disabled:opacity-60"
            >
              {sending ? tt("sending") : tt("sendButton")}
            </button>
          </form>
        )}

        <button
          onClick={() => { setThread(null); setCode(""); setSessionCode(""); }}
          className="text-sm text-gray-500 underline"
        >
          ← Check a different report
        </button>
      </main>
    );
  }

  // ── Code entry ─────────────────────────────────────────────────────────────
  return (
    <main className="max-w-lg mx-auto px-4 py-12">
      <h1 className="text-2xl font-bold mb-2">{t("followUpTitle")}</h1>
      <p className="text-gray-600 text-sm mb-8">{t("followUpInstruction")}</p>

      <form onSubmit={handleLookup} className="space-y-4">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          placeholder={t("codePlaceholder")}
          className="w-full border border-gray-300 rounded-xl px-4 py-4 text-lg font-mono tracking-wider"
          autoComplete="off"
          spellCheck={false}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={checking || !code}
          className="w-full bg-brand-600 text-white rounded-xl py-4 text-lg font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {checking ? t("checking") : t("checkButton")}
        </button>
      </form>

      <a
        href="/"
        className="block mt-6 text-sm text-center text-brand-600 underline"
      >
        ← Submit a new report
      </a>
    </main>
  );
}
