"use client";

import { useState, FormEvent } from "react";

export function InviteForm() {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"commissioner" | "admin" | "external">("commissioner");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success?: boolean; error?: string } | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, displayName: name, role }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setResult({ error: body.error ?? "Failed to invite user." });
      } else {
        setResult({ success: true });
        setEmail("");
        setName("");
      }
    } catch {
      setResult({ error: "An unexpected error occurred." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-3 items-end">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          placeholder="name@company.com"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm"
          placeholder="Full name"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as typeof role)}
          className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm bg-white"
        >
          <option value="commissioner">Commissioner</option>
          <option value="admin">Administrator</option>
          <option value="external">External party</option>
        </select>
      </div>
      <div className="sm:col-span-3 flex items-center gap-4">
        <button
          type="submit"
          disabled={loading}
          className="bg-brand-600 text-white rounded-xl px-6 py-3 text-sm font-semibold hover:bg-brand-700 disabled:opacity-60"
        >
          {loading ? "Sending…" : "Send invite"}
        </button>
        {result?.success && (
          <span className="text-sm text-green-700">✓ Invite sent.</span>
        )}
        {result?.error && (
          <span className="text-sm text-red-600">{result.error}</span>
        )}
      </div>
    </form>
  );
}
