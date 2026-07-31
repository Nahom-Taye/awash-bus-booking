DROP INDEX "Route_origin_destination_key";

CREATE UNIQUE INDEX "Route_operatorId_origin_destination_key" ON "Route"("operatorId", "origin", "destination");
