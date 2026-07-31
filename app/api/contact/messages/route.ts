import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";
import {
  isEmail,
  normalizeEmail,
  readJsonObject,
} from "@/lib/validation";

export async function POST(request: Request) {
  const body = await readJsonObject(request);

  if (!body) {
    return NextResponse.json(
      { error: "INVALID_CONTACT_REQUEST" },
      { status: 400 },
    );
  }

  const honeypot = typeof body.website === "string" ? body.website.trim() : "";
  if (honeypot) {
    return NextResponse.json(
      { error: "INVALID_CONTACT_REQUEST" },
      { status: 400 },
    );
  }

  const fullName =
    typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email =
    typeof body.email === "string" ? normalizeEmail(body.email) : "";
  const phone = typeof body.phone === "string" ? body.phone.trim() : "";
  const subject = typeof body.subject === "string" ? body.subject.trim() : "";
  const message = typeof body.message === "string" ? body.message.trim() : "";

  if (!fullName || !email || !message) {
    return NextResponse.json(
      { error: "CONTACT_FIELDS_REQUIRED" },
      { status: 400 },
    );
  }

  if (
    fullName.length < 2 ||
    fullName.length > 120 ||
    email.length > 254 ||
    !isEmail(email)
  ) {
    return NextResponse.json(
      { error: "INVALID_CONTACT_IDENTITY" },
      { status: 400 },
    );
  }

  if (phone.length > 40) {
    return NextResponse.json(
      { error: "INVALID_CONTACT_PHONE" },
      { status: 400 },
    );
  }

  if (subject.length > 160) {
    return NextResponse.json(
      { error: "INVALID_CONTACT_SUBJECT" },
      { status: 400 },
    );
  }

  if (message.length < 10 || message.length > 2_000) {
    return NextResponse.json(
      { error: "INVALID_CONTACT_MESSAGE" },
      { status: 400 },
    );
  }

  const session = await auth();
  const sessionUserId = session?.user?.id;
  const passenger = sessionUserId
    ? await prisma.user.findFirst({
        where: { id: sessionUserId, role: "PASSENGER" },
        select: { id: true },
      })
    : null;

  const storedMessage = await prisma.contactMessage.create({
    data: {
      fullName,
      email,
      phone: phone || null,
      subject: subject || null,
      message,
      passengerId: passenger?.id ?? null,
    },
    select: { id: true },
  });

  return NextResponse.json(
    { ok: true, id: storedMessage.id },
    { status: 201 },
  );
}
