import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  ethiopiaWallClockAsUtc,
  reconcileLifecycle,
} from "@/lib/lifecycle";

export async function GET() {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const operatorId = authorization.user.id;
  await reconcileLifecycle({ operatorId });
  const now = ethiopiaWallClockAsUtc();
  const [
    totalRoutes,
    totalBuses,
    upcomingTrips,
    confirmedBookings,
    unreadMessages,
    pendingPayments,
  ] = await Promise.all([
    prisma.route.count({ where: { operatorId, isActive: true } }),
    prisma.bus.count({ where: { operatorId, isActive: true } }),
    prisma.trip.count({
      where: {
        operatorId,
        status: "SCHEDULED",
        departureTime: { gt: now },
      },
    }),
    prisma.booking.count({
      where: {
        status: "CONFIRMED",
        trip: { operatorId, status: "SCHEDULED" },
      },
    }),
    prisma.contactMessage.count({ where: { status: "NEW" } }),
    prisma.payment.count({
      where: {
        status: "PENDING",
        booking: { trip: { operatorId } },
      },
    }),
  ]);

  return NextResponse.json({
    totalRoutes,
    totalBuses,
    upcomingTrips,
    confirmedBookings,
    unreadMessages,
    pendingPayments,
  });
}
