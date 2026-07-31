import { NextResponse } from "next/server";
import type { ContactMessageStatus, Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";

const PAGE_SIZE = 10;
const MESSAGE_STATUSES: ContactMessageStatus[] = ["NEW", "READ", "RESOLVED"];

export async function GET(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().slice(0, 120) ?? "";
  const rawStatus = searchParams.get("status")?.trim().toUpperCase() ?? "";
  const status = MESSAGE_STATUSES.includes(rawStatus as ContactMessageStatus)
    ? (rawStatus as ContactMessageStatus)
    : null;
  const page = Math.max(1, Number.parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where: Prisma.ContactMessageWhereInput = {
    ...(status ? { status } : {}),
    ...(query
      ? {
          OR: [
            { fullName: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { phone: { contains: query, mode: "insensitive" } },
            { subject: { contains: query, mode: "insensitive" } },
            { message: { contains: query, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [messages, total, unreadCount] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.contactMessage.count({ where }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
  ]);

  return NextResponse.json({
    messages,
    total,
    unreadCount,
    page,
    hasMore: page * PAGE_SIZE < total,
  });
}
