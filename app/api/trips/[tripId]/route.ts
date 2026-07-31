import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/payments";
import {
  ethiopiaWallClockAsUtc,
  reconcileLifecycle,
} from "@/lib/lifecycle";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) return authorization.response;

  const { tripId } = await params;
  await reconcileLifecycle({
    tripId,
    passengerId: authorization.user.id,
  });

  const trip = await prisma.trip.findFirst({
    where: {
      id: tripId,
      status: "SCHEDULED",
      departureTime: { gt: ethiopiaWallClockAsUtc() },
      operator: { role: "OPERATOR" },
      route: { isActive: true, archivedAt: null },
      bus: {
        isActive: true,
        archivedAt: null,
        operator: { role: "OPERATOR" },
      },
    },
    include: {
      route: true,
      bus: true,
      bookings: {
        where: { status: { in: [...ACTIVE_BOOKING_STATUSES] } },
        select: { id: true, seatNumber: true, status: true },
      },
    },
  });

  if (!trip) {
    return NextResponse.json({ error: "TRIP_NOT_FOUND" }, { status: 404 });
  }

  return NextResponse.json(trip, { status: 200 });
}
