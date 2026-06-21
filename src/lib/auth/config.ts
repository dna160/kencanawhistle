/**
 * Auth.js (next-auth v5) configuration.
 *
 * Strategy:
 * - Reviewers log in with email + password
 * - After password check, TOTP is verified as a second step
 * - Sessions are JWT-based, short-lived (8h)
 * - Reporters have NO accounts — they use access codes
 */
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "@/lib/db/client";
import argon2 from "argon2";
import { z } from "zod";
import type { ReviewerRole } from "@prisma/client";

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  totpCode: z.string().length(6),
});

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      name: "Email + TOTP",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        totpCode: { label: "2FA Code", type: "text" },
      },
      async authorize(credentials) {
        const parsed = credSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password, totpCode } = parsed.data;

        const reviewer = await db.reviewer.findUnique({ where: { email } });
        if (!reviewer || !reviewer.isActive) return null;

        // Password check (stored as argon2 hash in reviewer.totpSecretEnc is wrong —
        // password hash is stored separately; see reviewer.passwordHash below)
        // NOTE: passwordHash field is added in the migration below
        // @ts-expect-error — field added via migration, not yet in types
        const passwordHash: string | null = reviewer.passwordHash;
        if (!passwordHash) return null;

        const passwordOk = await argon2.verify(passwordHash, password);
        if (!passwordOk) return null;

        // TOTP check
        const { verifyTOTP } = await import("@/lib/auth/totp");
        if (!reviewer.totpVerified || !reviewer.totpSecretEnc) return null;
        const totpOk = await verifyTOTP(reviewer.totpSecretEnc, totpCode);
        if (!totpOk) return null;

        return {
          id: reviewer.id,
          email: reviewer.email,
          name: reviewer.displayName,
          role: reviewer.role as ReviewerRole,
        };
      },
    }),
  ],
  session: { strategy: "jwt", maxAge: 8 * 60 * 60 }, // 8-hour sessions
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: ReviewerRole }).role;
        token.reviewerId = user.id;
      }
      return token;
    },
    session({ session, token }) {
      session.user.role = token.role as ReviewerRole;
      session.user.reviewerId = token.reviewerId as string;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
});

// Extend next-auth types
declare module "next-auth" {
  interface User {
    role: ReviewerRole;
  }
  interface Session {
    user: {
      role: ReviewerRole;
      reviewerId: string;
    } & import("next-auth").DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: ReviewerRole;
    reviewerId: string;
  }
}
