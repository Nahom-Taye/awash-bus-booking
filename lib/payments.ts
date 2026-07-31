import type { Prisma } from "@prisma/client";
import { reconcileLifecycle } from "@/lib/lifecycle";

export const PAYMENT_WINDOW_MINUTES = 15;
export const PAYMENT_WINDOW_MS = PAYMENT_WINDOW_MINUTES * 60 * 1_000;

export const ACTIVE_BOOKING_STATUSES = [
  "PENDING",
  "CONFIRMED",
] as const;

export function createSeatKey(tripId: string, seatNumber: number): string {
  return `${tripId}:${seatNumber}`;
}

export function normalizeTransactionReference(value: string): string {
  return value.trim().replace(/\s+/g, "").toUpperCase();
}

export async function releaseExpiredSeatHolds(
  additionalWhere: Prisma.BookingWhereInput = {},
) {
  const id = typeof additionalWhere.id === "string" ? additionalWhere.id : undefined;
  const passengerId =
    typeof additionalWhere.passengerId === "string"
      ? additionalWhere.passengerId
      : undefined;
  const result = await reconcileLifecycle({
    bookingId: id,
    passengerId,
    deleteExpired: true,
  });
  return { count: result.expiredBookings };
}
