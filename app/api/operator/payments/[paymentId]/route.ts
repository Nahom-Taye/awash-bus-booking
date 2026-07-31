import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { resolveOperatorPaymentConfiguration } from "@/lib/payment-config";
import { createSeatKey, PAYMENT_WINDOW_MS } from "@/lib/payments";
import { readJsonObject } from "@/lib/validation";
import {
  ethiopiaWallClockAsUtc,
  ethiopiaWallClockToInstant,
} from "@/lib/lifecycle";

async function findPayment(paymentId: string) {
  return prisma.payment.findUnique({
    where: { id: paymentId },
    select: {
      id: true,
      bookingId: true,
      passengerId: true,
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
      verifiedBy: {
        select: {
          fullName: true,
          email: true,
        },
      },
      passenger: {
        select: {
          fullName: true,
          email: true,
          phone: true,
        },
      },
      booking: {
        select: {
          id: true,
          seatNumber: true,
          fullName: true,
          phone: true,
          email: true,
          status: true,
          holdExpiresAt: true,
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
            },
          },
        },
      },
    },
  });
}

function safePaymentResponse(
  payment: NonNullable<Awaited<ReturnType<typeof findPayment>>>,
) {
  return {
    id: payment.id,
    bookingId: payment.bookingId,
    method: payment.method,
    amount: payment.amount,
    currency: payment.currency,
    transactionReference: payment.transactionReference,
    senderName: payment.senderName,
    senderIdentifier: payment.senderIdentifier,
    status: payment.status,
    rejectionReason: payment.rejectionReason,
    verifiedAt: payment.verifiedAt,
    createdAt: payment.createdAt,
    updatedAt: payment.updatedAt,
    verifiedBy: payment.verifiedBy,
    passenger: payment.passenger,
    booking: {
      id: payment.booking.id,
      seatNumber: payment.booking.seatNumber,
      fullName: payment.booking.fullName,
      phone: payment.booking.phone,
      email: payment.booking.email,
      status: payment.booking.status,
      holdExpiresAt: payment.booking.holdExpiresAt,
      trip: {
        id: payment.booking.trip.id,
        date: payment.booking.trip.date,
        departureTime: payment.booking.trip.departureTime,
        arrivalTime: payment.booking.trip.arrivalTime,
        price: payment.booking.trip.price,
        status: payment.booking.trip.status,
        route: payment.booking.trip.route,
        bus: payment.booking.trip.bus,
      },
    },
  };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { paymentId } = await params;
  const payment = await findPayment(paymentId);
  if (!payment) {
    return NextResponse.json(
      { error: "PAYMENT_NOT_FOUND" },
      { status: 404 },
    );
  }
  if (payment.booking.trip.operatorId !== authorization.user.id) {
    return NextResponse.json({ error: "FORBIDDEN" }, { status: 403 });
  }

  return NextResponse.json(safePaymentResponse(payment));
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { paymentId } = await params;
  const body = await readJsonObject(request);
  const action =
    body?.action === "verify"
      ? "verify"
      : body?.action === "reject"
        ? "reject"
        : null;
  const rejectionReason =
    typeof body?.rejectionReason === "string"
      ? body.rejectionReason.trim()
      : "";

  if (!action) {
    return NextResponse.json(
      { error: "INVALID_PAYMENT_ACTION" },
      { status: 400 },
    );
  }
  if (
    action === "reject" &&
    (rejectionReason.length < 5 || rejectionReason.length > 500)
  ) {
    return NextResponse.json(
      { error: "REJECTION_REASON_REQUIRED" },
      { status: 400 },
    );
  }

  const now = new Date();
  const ethiopiaNow = ethiopiaWallClockAsUtc(now);
  const result = await prisma.$transaction(
    async (tx) => {
      const payment = await tx.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            trip: {
              select: {
                id: true,
                operatorId: true,
                price: true,
                status: true,
                departureTime: true,
              },
            },
            payments: {
              where: { status: "VERIFIED" },
              select: { id: true },
            },
          },
        },
      },
    });

    if (!payment) {
      return { error: "PAYMENT_NOT_FOUND", status: 404 as const };
    }
    if (payment.booking.trip.operatorId !== authorization.user.id) {
      return { error: "FORBIDDEN", status: 403 as const };
    }
    if (payment.status !== "PENDING") {
      return { error: "PAYMENT_NOT_PENDING", status: 409 as const };
    }

    if (action === "verify") {
      if (
        payment.booking.status !== "PENDING" ||
        !payment.booking.seatKey ||
        payment.booking.seatKey !==
          createSeatKey(
            payment.booking.tripId,
            payment.booking.seatNumber,
          ) ||
        payment.booking.trip.status !== "SCHEDULED" ||
        payment.booking.trip.departureTime <= ethiopiaNow
      ) {
        return { error: "BOOKING_NOT_VERIFIABLE", status: 409 as const };
      }
      if (
        payment.currency !== "ETB" ||
        !payment.amount.equals(payment.booking.trip.price)
      ) {
        return { error: "PAYMENT_AMOUNT_MISMATCH", status: 409 as const };
      }
      if (
        payment.booking.payments.some(
          (verified) => verified.id !== payment.id,
        )
      ) {
        return { error: "BOOKING_ALREADY_CONFIRMED", status: 409 as const };
      }

      const claimedPayment = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "VERIFIED",
          rejectionReason: null,
          verifiedById: authorization.user.id,
          verifiedAt: now,
        },
      });
      if (claimedPayment.count !== 1) {
        return { error: "PAYMENT_NOT_PENDING", status: 409 as const };
      }
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: {
          status: "CONFIRMED",
          holdExpiresAt: null,
        },
      });
    } else {
      const operatorPaymentSettings =
        await tx.operatorPaymentSettings.findUnique({
          where: {
            operatorId: payment.booking.trip.operatorId,
          },
          select: {
            telebirrEnabled: true,
            telebirrRecipientName: true,
            telebirrMerchantNumber: true,
            cbeEnabled: true,
            cbeAccountHolderName: true,
            cbeAccountNumber: true,
          },
        });
      const paymentConfiguration =
        resolveOperatorPaymentConfiguration(
          operatorPaymentSettings,
        );
      const hasAvailablePaymentMethod =
        paymentConfiguration.telebirr.available ||
        paymentConfiguration.cbe.available;
      const retryAvailable =
        payment.booking.trip.status === "SCHEDULED" &&
        payment.booking.trip.departureTime > ethiopiaNow &&
        hasAvailablePaymentMethod;
      const retryDeadline = new Date(
        Math.min(
          now.getTime() + PAYMENT_WINDOW_MS,
          ethiopiaWallClockToInstant(
            payment.booking.trip.departureTime,
          ).getTime(),
        ),
      );

      const claimedPayment = await tx.payment.updateMany({
        where: { id: payment.id, status: "PENDING" },
        data: {
          status: "REJECTED",
          rejectionReason,
          verifiedById: null,
          verifiedAt: null,
        },
      });
      if (claimedPayment.count !== 1) {
        return { error: "PAYMENT_NOT_PENDING", status: 409 as const };
      }
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: retryAvailable
          ? {
              status: "PENDING",
              holdExpiresAt: retryDeadline,
            }
          : {
              status:
                payment.booking.trip.status === "SCHEDULED" &&
                payment.booking.trip.departureTime > ethiopiaNow
                  ? "EXPIRED"
                  : "CANCELLED",
              seatKey: null,
              holdExpiresAt: null,
              expiredAt:
                payment.booking.trip.status === "SCHEDULED" &&
                payment.booking.trip.departureTime > ethiopiaNow
                  ? now
                  : null,
            },
      });
    }

      return { success: true };
    },
    { maxWait: 5_000, timeout: 15_000 },
  );

  if ("error" in result) {
    return NextResponse.json(
      { error: result.error },
      { status: result.status },
    );
  }

  const updated = await findPayment(paymentId);
  if (!updated) {
    return NextResponse.json(
      { error: "PAYMENT_NOT_FOUND" },
      { status: 404 },
    );
  }
  return NextResponse.json(safePaymentResponse(updated));
}
