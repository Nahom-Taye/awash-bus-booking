BEGIN;

CREATE TYPE "ContactMessageStatus" AS ENUM ('NEW', 'READ', 'RESOLVED');

ALTER TABLE "ContactMessage"
RENAME COLUMN "name" TO "fullName";

ALTER TABLE "ContactMessage"
ADD COLUMN "passengerId" TEXT,
ADD COLUMN "phone" TEXT,
ADD COLUMN "subject" TEXT,
ADD COLUMN "status" "ContactMessageStatus" NOT NULL DEFAULT 'NEW',
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "readAt" TIMESTAMP(3),
ADD COLUMN "resolvedAt" TIMESTAMP(3);

ALTER TABLE "ContactMessage"
ADD CONSTRAINT "ContactMessage_passengerId_fkey"
FOREIGN KEY ("passengerId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "ContactMessage_status_idx" ON "ContactMessage"("status");
CREATE INDEX "ContactMessage_createdAt_idx" ON "ContactMessage"("createdAt");
CREATE INDEX "ContactMessage_passengerId_idx" ON "ContactMessage"("passengerId");

ALTER TABLE "Route"
ADD COLUMN "originKey" TEXT,
ADD COLUMN "destinationKey" TEXT,
ADD COLUMN "originEn" TEXT,
ADD COLUMN "originAm" TEXT,
ADD COLUMN "destinationEn" TEXT,
ADD COLUMN "destinationAm" TEXT;

UPDATE "Route"
SET
  "originKey" = LOWER(
    REGEXP_REPLACE(BTRIM("origin"), '[[:space:]]+', '-', 'g')
  ),
  "destinationKey" = LOWER(
    REGEXP_REPLACE(BTRIM("destination"), '[[:space:]]+', '-', 'g')
  );

ALTER TABLE "Route"
ALTER COLUMN "originKey" SET NOT NULL,
ALTER COLUMN "destinationKey" SET NOT NULL;

DROP INDEX "Route_operatorId_origin_destination_key";

CREATE UNIQUE INDEX "Route_operatorId_originKey_destinationKey_key"
ON "Route"("operatorId", "originKey", "destinationKey");

COMMIT;
