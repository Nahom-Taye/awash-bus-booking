import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { getOperatorCheckoutPaymentConfiguration } from "@/lib/payment-config";
import {
  PAYMENT_WINDOW_MS,
  PAYMENT_WINDOW_MINUTES,
  releaseExpiredSeatHolds,
} from "@/lib/payments";
import { ethiopiaWallClockAsUtc } from "@/lib/lifecycle";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) {
    authorization.response.headers.set(
      "Cache-Control",
      NO_STORE_HEADERS["Cache-Control"],
    );
    return authorization.response;
  }

  const { bookingId } = await params;
  await releaseExpiredSeatHolds({
    id: bookingId,
    passengerId: authorization.user.id,
  });

  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      id: true,
      passengerId: true,
      seatNumber: true,
      seatKey: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
      holdExpiresAt: true,
      createdAt: true,
      trip: {
        select: {
          id: true,
          date: true,
          departureTime: true,
          arrivalTime: true,
          price: true,
          status: true,
          operatorId: true,
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
            },
          },
        },
      },
      payments: {
        select: {
          id: true,
          method: true,
          amount: true,
          currency: true,
          transactionReference: true,
          senderName: true,
          senderIdentifier: true,
          status: true,
          rejectionReason: true,
          verifiedAt: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
    },
  });

  if (!booking) {
    return NextResponse.json(
      { error: "BOOKING_NOT_FOUND" },
      { status: 404, headers: NO_STORE_HEADERS },
    );
  }
  if (booking.passengerId !== authorization.user.id) {
    return NextResponse.json(
      { error: "FORBIDDEN" },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const paymentConfiguration =
    await getOperatorCheckoutPaymentConfiguration(
      booking.trip.operatorId,
    );
  const paymentAvailable =
    paymentConfiguration.telebirr.available ||
    paymentConfiguration.cbe.available;
  const hasActivePayment = booking.payments.some(
    (payment) =>
      payment.status === "PENDING" || payment.status === "VERIFIED",
  );
  let bookingStatus = booking.status;
  let holdExpiresAt = booking.holdExpiresAt;

  if (
    !paymentAvailable &&
    booking.status === "PENDING" &&
    booking.seatKey &&
    !hasActivePayment
  ) {
    const released = await prisma.booking.updateMany({
      where: {
        id: booking.id,
        passengerId: authorization.user.id,
        status: "PENDING",
        seatKey: { not: null },
        payments: {
          none: { status: { in: ["PENDING", "VERIFIED"] } },
        },
      },
      data: {
        status: "EXPIRED",
        seatKey: null,
        holdExpiresAt: null,
        expiredAt: new Date(),
      },
    });
    if (released.count === 1) {
      bookingStatus = "EXPIRED";
      holdExpiresAt = null;
    }
  } else if (paymentAvailable) {
    const now = new Date();
    const legacyHoldExpiresAt = new Date(
      now.getTime() + PAYMENT_WINDOW_MS,
    );
    const activated = await prisma.booking.updateMany({
      where: {
        id: bookingId,
        passengerId: authorization.user.id,
        status: "PENDING",
        seatKey: { not: null },
        holdExpiresAt: null,
        payments: { none: {} },
        trip: {
          status: "SCHEDULED",
          departureTime: { gt: ethiopiaWallClockAsUtc(now) },
        },
      },
      data: {
        holdExpiresAt: legacyHoldExpiresAt,
      },
    });
    if (activated.count === 1) {
      holdExpiresAt = legacyHoldExpiresAt;
    }
  }

  return NextResponse.json(
    {
      booking: {
        id: booking.id,
        seatNumber: booking.seatNumber,
        fullName: booking.fullName,
        phone: booking.phone,
        email: booking.email,
        status: bookingStatus,
        holdExpiresAt,
        createdAt: booking.createdAt,
        trip: {
          id: booking.trip.id,
          date: booking.trip.date,
          departureTime: booking.trip.departureTime,
          arrivalTime: booking.trip.arrivalTime,
          price: booking.trip.price,
          status: booking.trip.status,
          route: booking.trip.route,
          bus: booking.trip.bus,
        },
        payments: booking.payments,
      },
      paymentConfiguration,
      paymentWindowMinutes: PAYMENT_WINDOW_MINUTES,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}
