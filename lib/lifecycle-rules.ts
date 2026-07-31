import type {
  BookingStatus,
  PaymentStatus,
  TripStatus,
} from "@prisma/client";

export const ETHIOPIA_TIME_ZONE = "Africa/Addis_Ababa";
export const EXPIRED_BOOKING_RETENTION_MS = 24 * 60 * 60 * 1_000;

type BookingForDeletion = {
  status: BookingStatus;
  payments: Array<{ status: PaymentStatus }>;
};


export function ethiopiaWallClockAsUtc(now = new Date()): Date {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ETHIOPIA_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, Number(part.value)]),
  );

  return new Date(
    Date.UTC(
      values.year,
      values.month - 1,
      values.day,
      values.hour,
      values.minute,
      values.second,
    ),
  );
}

export function hasTripArrived(arrivalTime: Date, now = new Date()): boolean {
  return arrivalTime <= ethiopiaWallClockAsUtc(now);
}

export function ethiopiaWallClockToInstant(value: Date): Date {
  return new Date(value.getTime() - 3 * 60 * 60 * 1_000);
}

export function bookingDeletionEligibility(booking: BookingForDeletion) {
  if (booking.status !== "EXPIRED") {
    return { canDelete: false, reason: "BOOKING_NOT_EXPIRED" as const };
  }
  if (booking.payments.length > 0) {
    return {
      canDelete: false,
      reason: "BOOKING_HAS_PAYMENT_HISTORY" as const,
    };
  }
  return { canDelete: true, reason: null };
}

export function tripDeletionEligibility(
  tripStatus: TripStatus,
  bookings: BookingForDeletion[],
) {
  const paymentCount = bookings.reduce(
    (count, booking) => count + booking.payments.length,
    0,
  );
  const verifiedPaymentCount = bookings.reduce(
    (count, booking) =>
      count +
      booking.payments.filter((payment) => payment.status === "VERIFIED")
        .length,
    0,
  );
  const canDelete =
    bookings.length === 0 ||
    bookings.every(
      (booking) =>
        booking.status === "EXPIRED" && booking.payments.length === 0,
    );

  return {
    canDelete,
    bookingCount: bookings.length,
    deletableExpiredBookingCount: canDelete ? bookings.length : 0,
    paymentCount,
    verifiedPaymentCount,
    refundRequiredCount: verifiedPaymentCount,
    recommendedAction: canDelete
      ? ("delete" as const)
      : tripStatus === "SCHEDULED"
        ? ("cancel" as const)
        : tripStatus === "ARCHIVED"
          ? ("viewHistory" as const)
          : ("archive" as const),
  };
}
