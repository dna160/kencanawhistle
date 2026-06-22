"use client";

import { useActionState } from "react";
import { loginAction } from "./actions";

export default function LoginPage() {
  // useActionState wires the Server Action directly as the form's action —
  // this is the correct Next.js 15 / next-auth v5 pattern for redirecting
  // Server Actions: the redirect response is handled at the framework level,
  // not intercepted by JS event handlers.
  const [error, formAction, pending] = useActionState(loginAction, null);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center px-4">
      <div className="max-w-sm mx-auto w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-4xl mb-4">🔒</div>
          <h1 className="text-2xl font-bold text-gray-900">Reviewer Sign In</h1>
          <p className="text-sm text-gray-500 mt-1">
            Board of Commissioners access
          </p>
        </div>

        <form action={formAction} className="bg-white rounded-2xl shadow-sm border p-8 space-y-5">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Email address
            </label>
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              name="password"
              required
              autoComplete="current-password"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">
              Authenticator code (2FA)
              <span className="ml-2 text-xs font-normal text-gray-400">
                — leave blank if not yet set up
              </span>
            </label>
            <input
              type="text"
              name="totpCode"
              inputMode="numeric"
              maxLength={6}
              autoComplete="one-time-code"
              placeholder="000000 (optional on first login)"
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base font-mono tracking-widest text-center text-xl"
            />
            <p className="text-xs text-gray-400 mt-1">
              First-time login: leave blank. You will be prompted to set up 2FA after signing in.
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={pending}
            className="w-full bg-brand-600 text-white rounded-xl py-4 font-semibold text-base hover:bg-brand-700 disabled:opacity-60 transition-colors"
          >
            {pending ? "Signing in…" : "Sign in"}
          </button>
        </form>

        <p className="text-center text-xs text-gray-400 mt-6">
          Need access? Contact your system administrator.
        </p>
        <p className="text-center text-xs text-gray-400 mt-2">
          <a href="/" className="underline">← Return to public report form</a>
        </p>
      </div>
    </div>
  );
}
