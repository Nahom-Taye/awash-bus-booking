import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

interface PassengerInput {
  seatNumber?: number;
  fullName?: string;
  phone?: string;
  email?: string;
}

interface CreateBookingBody {
  tripId?: string;
  passengers?: PassengerInput[];
}

const MAX_PASSENGERS = 6;

// Thrown inside the transaction to abort and roll back all bookings.
class BookingError extends Error {}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { tripId, passengers }: CreateBookingBody = await request
    .json()
    .catch(() => ({}));

  if (!tripId?.trim()) {
    return NextResponse.json({ error: "tripId is required" }, { status: 400 });
  }

  if (!Array.isArray(passengers) || passengers.length === 0) {
    return NextResponse.json(
      { error: "passengers must be a non-empty array" },
      { status: 400 }
    );
  }

  if (passengers.length > MAX_PASSENGERS) {
    return NextResponse.json(
      { error: `passengers must contain at most ${MAX_PASSENGERS} items` },
      { status: 400 }
    );
  }

  const invalidPassenger = passengers.some(
    (p) =>
      typeof p?.seatNumber !== "number" ||
      !Number.isInteger(p.seatNumber) ||
      p.seatNumber < 1 ||
      !p.fullName?.trim() ||
      !p.phone?.trim()
  );

  if (invalidPassenger) {
    return NextResponse.json(
      { error: "each passenger requires seatNumber, fullName, and phone" },
      { status: 400 }
    );
  }

  const seatNumbers = passengers.map((p) => p.seatNumber as number);

  if (new Set(seatNumbers).size !== seatNumbers.length) {
    return NextResponse.json(
      { error: "seatNumbers must be unique within the request" },
      { status: 400 }
    );
  }

  const passengerId = session.user.id;

  try {
    const bookings = await prisma.$transaction(async (tx) => {
      const trip = await tx.trip.findUnique({
        where: { id: tripId },
      });

      if (!trip) {
        throw new BookingError("TRIP_NOT_FOUND");
      }

      if (trip.status !== "SCHEDULED") {
        throw new BookingError("TRIP_NOT_SCHEDULED");
      }

      const existing = await tx.booking.findMany({
        where: { tripId, seatNumber: { in: seatNumbers } },
        select: { seatNumber: true },
      });

      if (existing.length > 0) {
        throw new BookingError("SEAT_TAKEN");
      }

      return Promise.all(
        passengers.map((p) =>
          tx.booking.create({
            data: {
              tripId,
              seatNumber: p.seatNumber as number,
              fullName: p.fullName as string,
              phone: p.phone as string,
              passengerId,
              status: "CONFIRMED",
            },
          })
        )
      );
    });

    return NextResponse.json(
      bookings.map((booking) => ({
        id: booking.id,
        seatNumber: booking.seatNumber,
        fullName: (booking as typeof booking & { fullName: string }).fullName,
      })),
      { status: 201 }
    );
  } catch (err) {
    if (err instanceof BookingError) {
      if (err.message === "TRIP_NOT_FOUND") {
        return NextResponse.json({ error: "Trip not found" }, { status: 404 });
      }
      if (err.message === "TRIP_NOT_SCHEDULED") {
        return NextResponse.json(
          { error: "Trip is not available for booking" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { error: "One or more seats are already booked" },
        { status: 409 }
      );
    }

    // Unique constraint violation — a seat was booked by a concurrent request.
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "One or more seats are already booked" },
        { status: 409 }
      );
    }

    throw err;
  }
}