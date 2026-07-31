import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import {
  EXPIRED_BOOKING_RETENTION_MS,
  ethiopiaWallClockAsUtc,
} from "@/lib/lifecycle-rules";
export {
  ETHIOPIA_TIME_ZONE,
  EXPIRED_BOOKING_RETENTION_MS,
  bookingDeletionEligibility,
  ethiopiaWallClockAsUtc,
  ethiopiaWallClockToInstant,
  hasTripArrived,
  tripDeletionEligibility,
} from "@/lib/lifecycle-rules";

type LifecycleScope = {
  operatorId?: string;
  passengerId?: string;
  tripId?: string;
  bookingId?: string;
};

type LifecycleOptions = LifecycleScope & {
  now?: Date;
  deleteExpired?: boolean;
};

function bookingScopeWhere(scope: LifecycleScope): Prisma.BookingWhereInput {
  return {
    ...(scope.bookingId ? { id: scope.bookingId } : {}),
    ...(scope.passengerId ? { passengerId: scope.passengerId } : {}),
    ...(scope.tripId ? { tripId: scope.tripId } : {}),
    ...(scope.operatorId
      ? { trip: { operatorId: scope.operatorId } }
      : {}),
  };
}

function tripScopeWhere(scope: LifecycleScope): Prisma.TripWhereInput {
  const bookingConditions: Prisma.TripWhereInput[] = [];
  if (scope.bookingId) {
    bookingConditions.push({ bookings: { some: { id: scope.bookingId } } });
  }
  if (scope.passengerId) {
    bookingConditions.push({
      bookings: { some: { passengerId: scope.passengerId } },
    });
  }
  return {
    ...(scope.operatorId ? { operatorId: scope.operatorId } : {}),
    ...(scope.tripId ? { id: scope.tripId } : {}),
    ...(bookingConditions.length > 0 ? { AND: bookingConditions } : {}),
  };
}

export async function reconcileLifecycleInTransaction(
  tx: Prisma.TransactionClient,
  options: LifecycleOptions = {},
) {
  const now = options.now ?? new Date();
  const bookingScope = bookingScopeWhere(options);
  const tripScope = tripScopeWhere(options);

  const expired = await tx.booking.updateMany({
    where: {
      ...bookingScope,
      status: "PENDING",
      holdExpiresAt: { lte: now },
    },
    data: {
      status: "EXPIRED",
      seatKey: null,
      holdExpiresAt: null,
      expiredAt: now,
    },
  });

  const completed = await tx.trip.updateMany({
    where: {
      ...tripScope,
      status: "SCHEDULED",
      arrivalTime: { lte: ethiopiaWallClockAsUtc(now) },
    },
    data: { status: "COMPLETED" },
  });

  let deletedExpired = { count: 0 };
  if (options.deleteExpired !== false) {
    const cutoff = new Date(now.getTime() - EXPIRED_BOOKING_RETENTION_MS);
    deletedExpired = await tx.booking.deleteMany({
      where: {
        ...bookingScope,
        status: "EXPIRED",
        expiredAt: { lte: cutoff },
        payments: { none: {} },
      },
    });
  }

  return {
    expiredBookings: expired.count,
    completedTrips: completed.count,
    deletedExpiredBookings: deletedExpired.count,
  };
}

export async function reconcileLifecycle(options: LifecycleOptions = {}) {
  return prisma.$transaction(
    (tx) => reconcileLifecycleInTransaction(tx, options),
    { maxWait: 5_000, timeout: 20_000 },
  );
}
