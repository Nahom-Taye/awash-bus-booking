import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  cityKeyCandidates,
  stableCityValue,
} from "@/lib/ethiopian-cities";
import { isDateOnly } from "@/lib/validation";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/payments";
import {
  ethiopiaWallClockAsUtc,
  reconcileLifecycle,
} from "@/lib/lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(request: Request) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) {
    authorization.response.headers.set(
      "Cache-Control",
      NO_STORE_HEADERS["Cache-Control"],
    );
    return authorization.response;
  }
  await reconcileLifecycle({ passengerId: authorization.user.id });

  const { searchParams } = new URL(request.url);
  const rawOrigin = searchParams.get("origin")?.trim() ?? "";
  const rawDestination = searchParams.get("destination")?.trim() ?? "";
  const origin = rawOrigin ? stableCityValue(rawOrigin) : "";
  const destination = rawDestination ? stableCityValue(rawDestination) : "";
  const date = searchParams.get("date")?.trim() ?? "";

  if (date && !isDateOnly(date)) {
    return NextResponse.json(
      { error: "SEARCH_INVALID_DATE" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  if (
    origin &&
    destination &&
    origin === destination
  ) {
    return NextResponse.json(
      { error: "SEARCH_SAME_CITY" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  const upcomingWhere: Prisma.TripWhereInput = {
    status: "SCHEDULED",
    departureTime: { gt: ethiopiaWallClockAsUtc() },
    operator: { role: "OPERATOR" },
    route: { isActive: true, archivedAt: null },
    bus: {
      isActive: true,
      archivedAt: null,
      operator: { role: "OPERATOR" },
    },
  };

  const routeFilter: Prisma.RouteWhereInput = {
    isActive: true,
    archivedAt: null,
  };

  if (origin) {
    routeFilter.originKey = { in: cityKeyCandidates(origin) };
  }

  if (destination) {
    routeFilter.destinationKey = { in: cityKeyCandidates(destination) };
  }

  const filteredWhere: Prisma.TripWhereInput = {
    ...upcomingWhere,
    ...(origin || destination ? { route: routeFilter } : {}),
  };

  if (date) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T00:00:00.000Z`);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    filteredWhere.date = { gte: dayStart, lt: dayEnd };
  }

  const [trips, totalUpcoming] = await Promise.all([
    prisma.trip.findMany({
      where: filteredWhere,
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
      orderBy: [{ departureTime: "asc" }, { id: "asc" }],
    }),
    prisma.trip.count({ where: upcomingWhere }),
  ]);

  return NextResponse.json(
    { trips, totalUpcoming },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
