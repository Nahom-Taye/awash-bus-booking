import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const origin = searchParams.get("origin")?.trim();
  const destination = searchParams.get("destination")?.trim();
  const date = searchParams.get("date")?.trim();

  if (!origin || !destination || !date) {
    return NextResponse.json(
      { error: "origin, destination, and date are required" },
      { status: 400 }
    );
  }

 const dayStart = new Date(`${date}T00:00:00.000Z`);

if (Number.isNaN(dayStart.getTime())) {
  return NextResponse.json(
    { error: "date must be a valid date" },
    { status: 400 }
  );
}

const dayEnd = new Date(`${date}T00:00:00.000Z`);
dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const trips = await prisma.trip.findMany({
    where: {
      status: "SCHEDULED",
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
      route: {
        origin: { equals: origin, mode: "insensitive" },
        destination: { equals: destination, mode: "insensitive" },
      },
    },
    include: {
      route: true,
      bus: true,
      _count: {
        select: {
          bookings: { where: { status: "CONFIRMED" } },
        },
      },
    },
    orderBy: { departureTime: "asc" },
  });

  return NextResponse.json(trips, { status: 200 });
}
