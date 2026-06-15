import { NextRequest, NextResponse } from "next/server";
import { Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

interface RegisterBody {
  fullName?: string;
  email?: string;
  phone?: string;
  password?: string;
  role?: Role;
}

export async function POST(request: NextRequest) {
  try {
    const { fullName, email, phone, password, role }: RegisterBody =
      await request.json();

    if (!fullName || !email || !phone || !password || !role) {
      return NextResponse.json(
        { error: "fullName, email, phone, password and role are required" },
        { status: 400 }
      );
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });

    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        fullName,
        email,
        phone,
        password: hashedPassword,
        role,
      },
      select: {
        id: true,
        email: true,
      },
    });

    return NextResponse.json(
      { id: user.id, email: user.email },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "An unexpected error occurred" },
      { status: 500 }
    );
  }
}
