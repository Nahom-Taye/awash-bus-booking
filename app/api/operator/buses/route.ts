import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { readJsonObject } from "@/lib/validation";
import { ethiopiaWallClockAsUtc } from "@/lib/lifecycle";

export async function GET() {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const now = ethiopiaWallClockAsUtc();
  const buses = await prisma.bus.findMany({
    where: { operatorId: authorization.user.id },
    include: {
      _count: { select: { trips: true } },
      trips: {
        where: {
          status: "SCHEDULED",
          departureTime: { gt: now },
        },
        select: {
          id: true,
          date: true,
          departureTime: true,
          route: {
            select: {
              origin: true,
              destination: true,
              originEn: true,
              originAm: true,
              destinationEn: true,
              destinationAm: true,
            },
          },
        },
        orderBy: { departureTime: "asc" },
        take: 5,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    buses.map(({ trips, ...bus }) => ({ ...bus, upcomingTrips: trips })),
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  const plateNumber =
    typeof body?.plateNumber === "string" ? body.plateNumber : "";
  const totalSeats = body?.totalSeats;

  if (!plateNumber?.trim()) {
    return NextResponse.json(
      { error: "PLATE_REQUIRED" },
      { status: 400 }
    );
  }

  if (
    typeof totalSeats !== "number" ||
    !Number.isInteger(totalSeats) ||
    totalSeats <= 0 ||
    totalSeats > 48
  ) {
    return NextResponse.json(
      { error: "INVALID_SEAT_COUNT" },
      { status: 400 }
    );
  }

  const trimmedPlateNumber = plateNumber.trim().toUpperCase();

  const existing = await prisma.bus.findUnique({
    where: { plateNumber: trimmedPlateNumber },
  });

  if (existing) {
    return NextResponse.json(
      { error: "PLATE_EXISTS" },
      { status: 409 }
    );
  }

  try {
    const bus = await prisma.bus.create({
      data: {
        plateNumber: trimmedPlateNumber,
        totalSeats,
        operatorId: authorization.user.id,
      },
      include: { _count: { select: { trips: true } } },
    });

    return NextResponse.json(
      { ...bus, upcomingTrips: [] },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "PLATE_EXISTS" },
        { status: 409 },
      );
    }
    throw error;
  }
}
