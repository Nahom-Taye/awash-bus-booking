BEGIN;

ALTER TYPE "BookingStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

CREATE TYPE "PaymentMethod" AS ENUM ('TELEBIRR', 'CBE');
CREATE TYPE "PaymentStatus" AS ENUM (
  'PENDING',
  'VERIFIED',
  'REJECTED',
  'EXPIRED',
  'REFUNDED'
);

ALTER TABLE "Booking"
  ADD COLUMN "seatKey" TEXT,
  ADD COLUMN "holdExpiresAt" TIMESTAMP(3);

UPDATE "Booking"
SET "seatKey" = "tripId" || ':' || "seatNumber"::TEXT
WHERE "status" IN ('PENDING', 'CONFIRMED');

DROP INDEX IF EXISTS "Booking_tripId_seatNumber_key";

CREATE UNIQUE INDEX "Booking_seatKey_key" ON "Booking"("seatKey");
CREATE INDEX "Booking_tripId_status_idx" ON "Booking"("tripId", "status");
CREATE INDEX "Booking_passengerId_createdAt_idx" ON "Booking"("passengerId", "createdAt");
CREATE INDEX "Booking_status_holdExpiresAt_idx" ON "Booking"("status", "holdExpiresAt");

CREATE TABLE "Payment" (
  "id" TEXT NOT NULL,
  "bookingId" TEXT NOT NULL,
  "passengerId" TEXT NOT NULL,
  "method" "PaymentMethod" NOT NULL,
  "amount" DECIMAL(12,2) NOT NULL,
  "currency" VARCHAR(3) NOT NULL DEFAULT 'ETB',
  "transactionReference" TEXT NOT NULL,
  "transactionReferenceKey" TEXT NOT NULL,
  "senderName" TEXT NOT NULL,
  "senderIdentifier" TEXT NOT NULL,
  "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
  "rejectionReason" TEXT,
  "verifiedById" TEXT,
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "Payment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Payment_bookingId_fkey"
    FOREIGN KEY ("bookingId") REFERENCES "Booking"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_passengerId_fkey"
    FOREIGN KEY ("passengerId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "Payment_verifiedById_fkey"
    FOREIGN KEY ("verifiedById") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "Payment_transactionReferenceKey_key"
  ON "Payment"("transactionReferenceKey");
CREATE INDEX "Payment_bookingId_createdAt_idx"
  ON "Payment"("bookingId", "createdAt");
CREATE INDEX "Payment_passengerId_createdAt_idx"
  ON "Payment"("passengerId", "createdAt");
CREATE INDEX "Payment_status_createdAt_idx"
  ON "Payment"("status", "createdAt");
CREATE INDEX "Payment_verifiedById_idx"
  ON "Payment"("verifiedById");

COMMIT;
