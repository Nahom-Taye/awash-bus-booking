BEGIN;

ALTER TABLE "Route"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Bus"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "archivedAt" TIMESTAMP(3);

CREATE INDEX "Route_operatorId_isActive_idx"
ON "Route"("operatorId", "isActive");

CREATE INDEX "Bus_operatorId_isActive_idx"
ON "Bus"("operatorId", "isActive");

COMMIT;
