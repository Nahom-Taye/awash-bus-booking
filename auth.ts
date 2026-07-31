import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import type { Role } from "@prisma/client";
import { isRole, normalizeEmail } from "@/lib/validation";

type CredentialsInput = Partial<Record<"email" | "password", unknown>>;

async function authorizeForRole(
  credentials: CredentialsInput | undefined,
  requiredRole: Role,
) {
  const rawEmail =
    typeof credentials?.email === "string" ? credentials.email : "";
  const password =
    typeof credentials?.password === "string" ? credentials.password : "";

  if (!rawEmail || !password) {
    return null;
  }

  const email = normalizeEmail(rawEmail);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    return null;
  }

  const isValid = await bcrypt.compare(password, user.password);

  if (!isValid || user.role !== requiredRole) {
    return null;
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [
    Credentials({
      id: "passenger-credentials",
      name: "Passenger credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeForRole(credentials, "PASSENGER");
      },
    }),
    Credentials({
      id: "operator-credentials",
      name: "Operator credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        return authorizeForRole(credentials, "OPERATOR");
      },
    }),
  ],
  session: {
    strategy: "jwt",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id as string;
        token.role = (user as { role: Role }).role;
        token.fullName = (user as { fullName: string }).fullName;
      }
      return token;
    },
    async session({ session, token }) {
      if (!session?.user) return session;

      if (typeof token.id === "string" && isRole(token.role)) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.fullName = token.fullName as string;
      }
      return session;
    },
  },
});
