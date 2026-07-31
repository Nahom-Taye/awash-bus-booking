import { NextResponse } from "next/server";
import type { Role } from "@prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import { isRole } from "@/lib/validation";

type AuthorizedUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
};

type AuthorizationResult =
  | { user: AuthorizedUser; response: null }
  | { user: null; response: NextResponse };

export async function requireRole(role: Role): Promise<AuthorizationResult> {
  const session = await auth();
  const sessionUser = session?.user;

  if (!sessionUser?.id || !isRole(sessionUser.role)) {
    return {
      user: null,
      response: NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 }),
    };
  }

  const user = await prisma.user.findUnique({
    where: { id: sessionUser.id },
    select: { id: true, email: true, fullName: true, role: true },
  });

  if (!user || user.role !== sessionUser.role) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "SESSION_EXPIRED" },
        { status: 401 },
      ),
    };
  }

  if (user.role !== role) {
    return {
      user: null,
      response: NextResponse.json({ error: "FORBIDDEN" }, { status: 403 }),
    };
  }

  return { user, response: null };
}
