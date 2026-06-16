import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

interface CreateTripBody {
  routeId?: string;
  busId?: string;
  date?: string;
  departureTime?: string;
  arrivalTime?: string;
  price?: number;
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const trips = await prisma.trip.findMany({
    where: { operatorId: session.user.id },
    include: { route: true, bus: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(trips, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const {
    routeId,
    busId,
    date,
    departureTime,
    arrivalTime,
    price,
  }: CreateTripBody = await request.json().catch(() => ({}));

  if (
    !routeId?.trim() ||
    !busId?.trim() ||
    !date?.trim() ||
    !departureTime?.trim() ||
    !arrivalTime?.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "routeId, busId, date, departureTime, and arrivalTime are required",
      },
      { status: 400 }
    );
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "price must be a positive number" },
      { status: 400 }
    );
  }

  const parsedDate = new Date(date);
  const parsedDeparture = new Date(departureTime);
  const parsedArrival = new Date(arrivalTime);

  if (
    Number.isNaN(parsedDate.getTime()) ||
    Number.isNaN(parsedDeparture.getTime()) ||
    Number.isNaN(parsedArrival.getTime())
  ) {
    return NextResponse.json(
      { error: "date, departureTime, and arrivalTime must be valid dates" },
      { status: 400 }
    );
  }

  const route = await prisma.route.findUnique({
    where: { id: routeId },
  });

  if (!route || route.operatorId !== session.user.id) {
    return NextResponse.json(
      { error: "Route does not belong to this operator" },
      { status: 403 }
    );
  }

  const bus = await prisma.bus.findUnique({
    where: { id: busId },
  });

  if (!bus || bus.operatorId !== session.user.id) {
    return NextResponse.json(
      { error: "Bus does not belong to this operator" },
      { status: 403 }
    );
  }

  const trip = await prisma.trip.create({
    data: {
      date: parsedDate,
      departureTime: parsedDeparture,
      arrivalTime: parsedArrival,
      price,
      routeId,
      busId,
      operatorId: session.user.id,
    },
    include: { route: true, bus: true },
  });

  return NextResponse.json(trip, { status: 201 });
}
