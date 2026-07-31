import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { resolveOperatorPaymentConfiguration } from "@/lib/payment-config";
import {
  createSeatKey,
  PAYMENT_WINDOW_MS,
} from "@/lib/payments";
import {
  ethiopiaWallClockAsUtc,
  reconcileLifecycleInTransaction,
} from "@/lib/lifecycle";
import {
  isEmail,
  normalizeEmail,
  readJsonObject,
} from "@/lib/validation";

interface PassengerInput {
  seatNumber?: number;
  fullName?: string;
  phone?: string;
  email?: string;
}

const MAX_PASSENGERS = 6;

class BookingError extends Error {}

export async function POST(request: Request) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  const tripId = typeof body?.tripId === "string" ? body.tripId.trim() : "";
  const passengers = Array.isArray(body?.passengers)
    ? (body.passengers as PassengerInput[])
    : undefined;

  if (!tripId) {
    return NextResponse.json({ error: "TRIP_ID_REQUIRED" }, { status: 400 });
  }

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return NextResponse.json(
      { error: "PASSENGERS_REQUIRED" },
      { status: 400 },
    );
  }

  if (passengers.length > MAX_PASSENGERS) {
    return NextResponse.json(
      { error: "TOO_MANY_PASSENGERS" },
      { status: 400 },
    );
  }

  const invalidPassenger = passengers.some(
    (passenger) =>
      typeof passenger?.seatNumber !== "number" ||
      !Number.isInteger(passenger.seatNumber) ||
      passenger.seatNumber < 1 ||
      typeof passenger.fullName !== "string" ||
      !passenger.fullName.trim() ||
      typeof passenger.phone !== "string" ||
      !passenger.phone.trim() ||
      passenger.fullName.trim().length > 120 ||
      passenger.phone.trim().length > 80 ||
      (passenger.email !== undefined &&
        (typeof passenger.email !== "string" ||
          !isEmail(normalizeEmail(passenger.email)) ||
          normalizeEmail(passenger.email).length > 254)),
  );

  if (invalidPassenger) {
    return NextResponse.json(
      { error: "INVALID_PASSENGER" },
      { status: 400 },
    );
  }

  const seatNumbers = passengers.map(
    (passenger) => passenger.seatNumber as number,
  );
  if (new Set(seatNumbers).size !== seatNumbers.length) {
    return NextResponse.json(
      { error: "DUPLICATE_SEATS" },
      { status: 400 },
    );
  }

  const passengerId = authorization.user.id;
  const now = new Date();
  const ethiopiaNow = ethiopiaWallClockAsUtc(now);
  const holdExpiresAt = new Date(now.getTime() + PAYMENT_WINDOW_MS);

  try {
    const bookings = await prisma.$transaction(
      async (tx) => {
        await reconcileLifecycleInTransaction(tx, {
          tripId,
          now,
          deleteExpired: false,
        });

        const trip = await tx.trip.findUnique({
          where: { id: tripId },
          include: {
            route: { select: { isActive: true, archivedAt: true } },
            bus: {
              select: {
                totalSeats: true,
                isActive: true,
                archivedAt: true,
              },
            },
          },
        });

        if (!trip) throw new BookingError("TRIP_NOT_FOUND");
        if (
          trip.status !== "SCHEDULED" ||
          trip.departureTime <= ethiopiaNow ||
          !trip.route.isActive ||
          trip.route.archivedAt ||
          !trip.bus.isActive ||
          trip.bus.archivedAt
        ) {
          throw new BookingError("TRIP_NOT_SCHEDULED");
        }
        const operatorPaymentSettings =
          await tx.operatorPaymentSettings.findUnique({
            where: { operatorId: trip.operatorId },
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
        if (
          !paymentConfiguration.telebirr.available &&
          !paymentConfiguration.cbe.available
        ) {
          throw new BookingError("ONLINE_PAYMENT_UNAVAILABLE");
        }
        if (
          seatNumbers.some(
            (seatNumber) => seatNumber > trip.bus.totalSeats,
          )
        ) {
          throw new BookingError("INVALID_SEAT");
        }

        const existing = await tx.booking.findMany({
          where: {
            seatKey: {
              in: seatNumbers.map((seatNumber) =>
                createSeatKey(tripId, seatNumber),
              ),
            },
          },
          select: { seatNumber: true },
        });
        if (existing.length > 0) throw new BookingError("SEAT_TAKEN");

        return Promise.all(
          passengers.map((passenger) =>
            tx.booking.create({
              data: {
                tripId,
                seatNumber: passenger.seatNumber as number,
                seatKey: createSeatKey(
                  tripId,
                  passenger.seatNumber as number,
                ),
                fullName: (passenger.fullName as string).trim(),
                phone: (passenger.phone as string).trim(),
                email: passenger.email
                  ? normalizeEmail(passenger.email)
                  : null,
                passengerId,
                status: "PENDING",
                holdExpiresAt,
              },
              select: {
                id: true,
                seatNumber: true,
                fullName: true,
                status: true,
                holdExpiresAt: true,
              },
            }),
          ),
        );
      },
      {
        maxWait: 5_000,
        timeout: 15_000,
      },
    );

    return NextResponse.json(bookings, { status: 201 });
  } catch (error) {
    if (error instanceof BookingError) {
      if (error.message === "TRIP_NOT_FOUND") {
        return NextResponse.json(
          { error: "TRIP_NOT_FOUND" },
          { status: 404 },
        );
      }
      if (error.message === "TRIP_NOT_SCHEDULED") {
        return NextResponse.json(
          { error: "TRIP_NOT_SCHEDULED" },
          { status: 409 },
        );
      }
      if (error.message === "ONLINE_PAYMENT_UNAVAILABLE") {
        return NextResponse.json(
          { error: "ONLINE_PAYMENT_UNAVAILABLE" },
          { status: 503 },
        );
      }
      if (error.message === "INVALID_SEAT") {
        return NextResponse.json(
          { error: "INVALID_SEAT" },
          { status: 400 },
        );
      }
      return NextResponse.json({ error: "SEAT_TAKEN" }, { status: 409 });
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json({ error: "SEAT_TAKEN" }, { status: 409 });
    }

    throw error;
  }
}
