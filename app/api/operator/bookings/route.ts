import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: { trip: { operatorId: session.user.id } },
    select: {
      id: true,
      seatNumber: true,
      status: true,
      fullName: true,
      phone: true,
      createdAt: true,
      trip: {
        select: {
          date: true,
          departureTime: true,
          route: {
            select: {
              origin: true,
              destination: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bookings, { status: 200 });
}