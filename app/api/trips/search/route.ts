import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/payments";
import { requireRole } from "@/lib/authorization";
import {
  ethiopiaWallClockAsUtc,
  reconcileLifecycle,
} from "@/lib/lifecycle";
import {
  cityKeyCandidates,
  stableCityValue,
} from "@/lib/ethiopian-cities";
import { isDateOnly } from "@/lib/validation";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(request: Request) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) return authorization.response;

  await reconcileLifecycle({ passengerId: authorization.user.id });
  const { searchParams } = new URL(request.url);

  const rawOrigin = searchParams.get("origin")?.trim();
  const rawDestination = searchParams.get("destination")?.trim();
  const origin = rawOrigin ? stableCityValue(rawOrigin) : "";
  const destination = rawDestination ? stableCityValue(rawDestination) : "";
  const date = searchParams.get("date")?.trim();

  if (!origin || !destination || !date) {
    return NextResponse.json(
      { error: "SEARCH_FIELDS_REQUIRED" },
      { status: 400, headers: NO_STORE_HEADERS }
    );
  }

  if (!isDateOnly(date)) {
    return NextResponse.json(
      { error: "SEARCH_INVALID_DATE" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (origin === destination) {
    return NextResponse.json(
      { error: "SEARCH_SAME_CITY" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T00:00:00.000Z`);
  dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);

  const trips = await prisma.trip.findMany({
    where: {
      status: "SCHEDULED",
      departureTime: { gt: ethiopiaWallClockAsUtc() },
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
      route: {
        isActive: true,
        archivedAt: null,
        originKey: { in: cityKeyCandidates(origin) },
        destinationKey: { in: cityKeyCandidates(destination) },
      },
      bus: {
        isActive: true,
        archivedAt: null,
        operator: { role: "OPERATOR" },
      },
    },
    include: {
      route: true,
      bus: true,
      _count: {
        select: {
          bookings: {
            where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } },
          },
        },
      },
    },
    orderBy: { departureTime: "asc" },
  });

  return NextResponse.json(trips, {
    status: 200,
    headers: NO_STORE_HEADERS,
  });
}
