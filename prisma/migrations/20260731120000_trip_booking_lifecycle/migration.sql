ALTER TYPE "TripStatus" ADD VALUE IF NOT EXISTS 'ARCHIVED';

ALTER TABLE "Trip"
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Booking"
ADD COLUMN "expiredAt" TIMESTAMP(3);

CREATE INDEX "Booking_status_expiredAt_idx"
ON "Booking"("status", "expiredAt");

UPDATE "Booking"
SET "expiredAt" = COALESCE("holdExpiresAt", "updatedAt")
WHERE "status" = 'EXPIRED' AND "expiredAt" IS NULL;
