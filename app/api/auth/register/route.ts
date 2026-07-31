import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import {
  isEmail,
  normalizeEmail,
  readJsonObject,
} from "@/lib/validation";

export async function POST(request: NextRequest) {
  try {
    const body = await readJsonObject(request);

    if (!body) {
      return NextResponse.json(
        { error: "INVALID_REGISTRATION_REQUEST" },
        { status: 400 },
      );
    }

    const fullName =
      typeof body.fullName === "string" ? body.fullName.trim() : "";
    const email =
      typeof body.email === "string" ? normalizeEmail(body.email) : "";
    const phone = typeof body.phone === "string" ? body.phone.trim() : "";
    const password = typeof body.password === "string" ? body.password : "";

    if ("role" in body) {
      return NextResponse.json(
        { error: "ROLE_NOT_ALLOWED" },
        { status: 400 },
      );
    }

    if (!fullName || !email || !phone || !password) {
      return NextResponse.json(
        { error: "REQUIRED_REGISTRATION_FIELDS" },
        { status: 400 }
      );
    }

    if (fullName.length > 120 || phone.length > 40) {
      return NextResponse.json(
        { error: "PROFILE_FIELD_TOO_LONG" },
        { status: 400 },
      );
    }

    if (!isEmail(email) || email.length > 254) {
      return NextResponse.json(
        { error: "INVALID_EMAIL" },
        { status: 400 },
      );
    }

    if (password.length < 8 || password.length > 72) {
      return NextResponse.json(
        { error: "INVALID_PASSWORD_LENGTH" },
        { status: 400 },
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        password: hashedPassword,
        role: "PASSENGER",
      },
      select: {
        id: true,
        email: true,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "EMAIL_EXISTS" },
        { status: 409 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientInitializationError ||
      (error instanceof Prisma.PrismaClientKnownRequestError &&
        ["P1000", "P1001", "P1002", "P1003", "P1017"].includes(error.code))
    ) {
      console.error("Registration database error:", error);
      return NextResponse.json(
        {
          error: "REGISTRATION_UNAVAILABLE",
        },
        { status: 503 },
      );
    }

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: "INVALID_REGISTRATION_REQUEST" },
        { status: 400 },
      );
    }

    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "UNEXPECTED_ERROR" },
      { status: 500 },
    );
  }
}
