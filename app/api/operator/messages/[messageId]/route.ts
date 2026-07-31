import { NextResponse } from "next/server";
import type { ContactMessageStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { readJsonObject } from "@/lib/validation";

const MESSAGE_STATUSES: ContactMessageStatus[] = ["NEW", "READ", "RESOLVED"];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ messageId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { messageId } = await params;
  const body = await readJsonObject(request);
  const rawStatus =
    typeof body?.status === "string" ? body.status.trim().toUpperCase() : "";

  if (!MESSAGE_STATUSES.includes(rawStatus as ContactMessageStatus)) {
    return NextResponse.json(
      { error: "INVALID_MESSAGE_STATUS" },
      { status: 400 },
    );
  }

  const current = await prisma.contactMessage.findUnique({
    where: { id: messageId },
  });

  if (!current) {
    return NextResponse.json(
      { error: "MESSAGE_NOT_FOUND" },
      { status: 404 },
    );
  }

  const status = rawStatus as ContactMessageStatus;
  const now = new Date();
  const message = await prisma.contactMessage.update({
    where: { id: messageId },
    data:
      status === "NEW"
        ? { status, readAt: null, resolvedAt: null }
        : status === "READ"
          ? {
              status,
              readAt: current.readAt ?? now,
              resolvedAt: null,
            }
          : {
              status,
              readAt: current.readAt ?? now,
              resolvedAt: now,
            },
  });

  return NextResponse.json(message);
}
