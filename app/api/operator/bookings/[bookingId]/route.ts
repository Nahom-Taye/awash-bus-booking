import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  bookingDeletionEligibility,
  reconcileLifecycle,
  reconcileLifecycleInTransaction,
} from "@/lib/lifecycle";
import { ACTIVE_BOOKING_STATUSES } from "@/lib/payments";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { bookingId } = await params;
  await reconcileLifecycle({
    bookingId,
    operatorId: authorization.user.id,
  });
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      status: true,
      seatNumber: true,
      fullName: true,
      phone: true,
      email: true,
      holdExpiresAt: true,
      expiredAt: true,
      createdAt: true,
      payments: { select: { status: true } },
      passenger: {
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
        },
      },
      trip: {
        select: {
          id: true,
          operatorId: true,
          date: true,
          departureTime: true,
          arrivalTime: true,
          price: true,
          status: true,
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
          bus: {
            select: {
              plateNumber: true,
              totalSeats: true,
            },
          },
          _count: {
            select: {
              bookings: {
                where: {
                  status: { in: [...ACTIVE_BOOKING_STATUSES] },
                },
              },
            },
          },
        },
      },
    },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "BOOKING_NOT_FOUND" },
      { status: 404 },
    );
  }

  if (booking.trip.operatorId !== authorization.user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403 },
    );
  }

  const {
    trip: tripWithOwnership,
    payments,
    ...safeBooking
  } = booking;
  return NextResponse.json({
    ...safeBooking,
    deletion: bookingDeletionEligibility({
      status: booking.status,
      payments,
    }),
    hasPaymentHistory: payments.length > 0,
    refundRequired: payments.some((payment) => payment.status === "VERIFIED"),
    trip: {
      id: tripWithOwnership.id,
      date: tripWithOwnership.date,
      departureTime: tripWithOwnership.departureTime,
      arrivalTime: tripWithOwnership.arrivalTime,
      price: tripWithOwnership.price,
      status: tripWithOwnership.status,
      route: tripWithOwnership.route,
      bus: tripWithOwnership.bus,
      bookedSeats: tripWithOwnership._count.bookings,
      remainingSeats: Math.max(
        0,
        tripWithOwnership.bus.totalSeats -
          tripWithOwnership._count.bookings,
      ),
    },
  });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;
  const { bookingId } = await params;

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await reconcileLifecycleInTransaction(tx, {
          bookingId,
          operatorId: authorization.user.id,
          deleteExpired: false,
        });
        const booking = await tx.booking.findUnique({
          where: { id: bookingId },
          select: {
            id: true,
            status: true,
            trip: { select: { operatorId: true } },
            payments: { select: { status: true } },
          },
        });
        if (!booking) {
          return { status: 404 as const, error: "BOOKING_NOT_FOUND" };
        }
        if (booking.trip.operatorId !== authorization.user.id) {
          return { status: 403 as const, error: "FORBIDDEN" };
        }

        const deletion = bookingDeletionEligibility(booking);
        if (!deletion.canDelete) {
          return {
            status: 409 as const,
            error: "BOOKING_DELETE_UNSAFE",
            reason: deletion.reason,
          };
        }

        const deleted = await tx.booking.deleteMany({
          where: {
            id: bookingId,
            status: "EXPIRED",
            payments: { none: {} },
            trip: { operatorId: authorization.user.id },
          },
        });
        if (deleted.count !== 1) {
          return {
            status: 409 as const,
            error: "BOOKING_DELETE_CONFLICT",
          };
        }
        return { status: 200 as const, outcome: "deleted" as const };
      },
      { maxWait: 5_000, timeout: 20_000 },
    );

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "BOOKING_DELETE_UNSAFE" },
        { status: 409 },
      );
    }
    throw error;
  }
}
