import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "PASSENGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bookings = await prisma.booking.findMany({
    where: { passengerId: session.user.id },
    select: {
      id: true,
      seatNumber: true,
      fullName: true,
      phone: true,
      status: true,
      createdAt: true,
      trip: {
        select: {
          date: true,
          departureTime: true,
          arrivalTime: true,
          price: true,
          route: {
            select: {
              origin: true,
              destination: true,
            },
          },
          bus: {
            select: {
              plateNumber: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bookings, { status: 200 });
}
