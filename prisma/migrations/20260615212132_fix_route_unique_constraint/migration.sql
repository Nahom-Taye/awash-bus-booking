/*
  Warnings:

  - A unique constraint covering the columns `[operatorId,origin,destination]` on the table `Route` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Route_origin_destination_key";

-- CreateIndex
CREATE UNIQUE INDEX "Route_operatorId_origin_destination_key" ON "Route"("operatorId", "origin", "destination");
