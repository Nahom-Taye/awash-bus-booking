import { NextResponse } from "next/server";
import {
  PaymentMethod,
  Prisma,
  type PaymentStatus,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { resolveOperatorPaymentConfiguration } from "@/lib/payment-config";
import {
  normalizeTransactionReference,
  releaseExpiredSeatHolds,
} from "@/lib/payments";
import { readJsonObject } from "@/lib/validation";
import { ethiopiaWallClockAsUtc } from "@/lib/lifecycle";

const PAGE_SIZE = 10;
const PAYMENT_METHODS: PaymentMethod[] = ["TELEBIRR", "CBE"];
const ACTIVE_PAYMENT_STATUSES: PaymentStatus[] = ["PENDING", "VERIFIED"];
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

  await releaseExpiredSeatHolds({
    passengerId: authorization.user.id,
  });

  const { searchParams } = new URL(request.url);
  const bookingId = searchParams.get("bookingId")?.trim() ?? "";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );

  if (bookingId) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      select: { passengerId: true },
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
  }

  const where: Prisma.PaymentWhereInput = {
    passengerId: authorization.user.id,
    ...(bookingId ? { bookingId } : {}),
  };
  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        bookingId: true,
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
        booking: {
          select: {
            seatNumber: true,
            status: true,
            trip: {
              select: {
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
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json(
    {
      payments,
      total,
      page,
      hasMore: page * PAGE_SIZE < total,
    },
    { status: 200, headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  const bookingId =
    typeof body?.bookingId === "string" ? body.bookingId.trim() : "";
  const method =
    typeof body?.method === "string"
      ? body.method.trim().toUpperCase()
      : "";
  const transactionReference =
    typeof body?.transactionReference === "string"
      ? body.transactionReference.trim()
      : "";
  const senderName =
    typeof body?.senderName === "string" ? body.senderName.trim() : "";
  const senderIdentifier =
    typeof body?.senderIdentifier === "string"
      ? body.senderIdentifier.trim()
      : "";

  if (!bookingId) {
    return NextResponse.json(
      { error: "BOOKING_ID_REQUIRED" },
      { status: 400 },
    );
  }
  if (!PAYMENT_METHODS.includes(method as PaymentMethod)) {
    return NextResponse.json(
      { error: "INVALID_PAYMENT_METHOD" },
      { status: 400 },
    );
  }
  if (
    transactionReference.length < 4 ||
    transactionReference.length > 100 ||
    senderName.length < 2 ||
    senderName.length > 120 ||
    senderIdentifier.length < 3 ||
    senderIdentifier.length > 100
  ) {
    return NextResponse.json(
      { error: "INVALID_PAYMENT_DETAILS" },
      { status: 400 },
    );
  }

  const paymentMethod = method as PaymentMethod;

  await releaseExpiredSeatHolds({
    id: bookingId,
    passengerId: authorization.user.id,
  });
  const transactionReferenceKey = normalizeTransactionReference(
    transactionReference,
  );
  const now = new Date();
  const ethiopiaNow = ethiopiaWallClockAsUtc(now);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          trip: {
            select: {
              price: true,
              status: true,
              departureTime: true,
              operatorId: true,
            },
          },
          payments: {
            where: { status: { in: ACTIVE_PAYMENT_STATUSES } },
            select: { id: true, status: true },
            take: 1,
          },
        },
      });

      if (!booking) {
        return { error: "BOOKING_NOT_FOUND", status: 404 as const };
      }
      if (booking.passengerId !== authorization.user.id) {
        return { error: "FORBIDDEN", status: 403 as const };
      }
      const operatorPaymentSettings =
        await tx.operatorPaymentSettings.findUnique({
          where: { operatorId: booking.trip.operatorId },
          select: {
            telebirrEnabled: true,
            telebirrRecipientName: true,
            telebirrMerchantNumber: true,
            cbeEnabled: true,
            cbeAccountHolderName: true,
            cbeAccountNumber: true,
          },
        });
      const configuration = resolveOperatorPaymentConfiguration(
        operatorPaymentSettings,
      );
      const methodAvailable =
        paymentMethod === "TELEBIRR"
          ? configuration.telebirr.available
          : configuration.cbe.available;
      if (!methodAvailable) {
        return {
          error: "PAYMENT_METHOD_UNAVAILABLE",
          status: 503 as const,
        };
      }
      if (booking.status === "CONFIRMED") {
        return { error: "BOOKING_ALREADY_CONFIRMED", status: 409 as const };
      }
      if (
        booking.status !== "PENDING" ||
        !booking.seatKey ||
        !booking.holdExpiresAt ||
        booking.holdExpiresAt <= now
      ) {
        return { error: "PAYMENT_WINDOW_EXPIRED", status: 409 as const };
      }
      if (
        booking.trip.status !== "SCHEDULED" ||
        booking.trip.departureTime <= ethiopiaNow
      ) {
        return { error: "TRIP_NOT_SCHEDULED", status: 409 as const };
      }
      if (booking.payments.length > 0) {
        return {
          error: "PAYMENT_ALREADY_SUBMITTED",
          status: 409 as const,
        };
      }

      if (body?.amount !== undefined) {
        const suppliedAmount =
          typeof body.amount === "number" || typeof body.amount === "string"
            ? Number(body.amount)
            : Number.NaN;
        if (
          !Number.isFinite(suppliedAmount) ||
          !booking.trip.price.equals(suppliedAmount)
        ) {
          return {
            error: "PAYMENT_AMOUNT_MISMATCH",
            status: 400 as const,
          };
        }
      }

      const claimed = await tx.booking.updateMany({
        where: {
          id: booking.id,
          passengerId: authorization.user.id,
          status: "PENDING",
          seatKey: { not: null },
          holdExpiresAt: { gt: now },
        },
        data: { holdExpiresAt: null },
      });
      if (claimed.count !== 1) {
        return { error: "PAYMENT_WINDOW_EXPIRED", status: 409 as const };
      }

      const payment = await tx.payment.create({
        data: {
          bookingId: booking.id,
          passengerId: authorization.user.id,
          method: paymentMethod,
          amount: booking.trip.price,
          currency: "ETB",
          transactionReference,
          transactionReferenceKey,
          senderName,
          senderIdentifier,
          status: "PENDING",
        },
        select: {
          id: true,
          bookingId: true,
          method: true,
          amount: true,
          currency: true,
          transactionReference: true,
          senderName: true,
          senderIdentifier: true,
          status: true,
          createdAt: true,
        },
      });

      return { payment };
    }, {
      maxWait: 5_000,
      timeout: 15_000,
    });

    if ("error" in result) {
      return NextResponse.json(
        { error: result.error },
        { status: result.status },
      );
    }
    return NextResponse.json(result.payment, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "TRANSACTION_REFERENCE_EXISTS" },
        { status: 409 },
      );
    }
    throw error;
  }
}
