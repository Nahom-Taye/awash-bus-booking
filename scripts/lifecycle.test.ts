import assert from "node:assert/strict";
import test from "node:test";
import {
  bookingDeletionEligibility,
  ethiopiaWallClockAsUtc,
  ethiopiaWallClockToInstant,
  hasTripArrived,
  tripDeletionEligibility,
} from "../lib/lifecycle-rules.ts";

test("Ethiopia wall-clock completion waits for the arrival time", () => {
  const arrival = new Date("2026-07-31T12:00:00.000Z");
  const beforeArrival = new Date("2026-07-31T08:30:00.000Z");
  const afterArrival = new Date("2026-07-31T09:01:00.000Z");

  assert.equal(
    ethiopiaWallClockAsUtc(beforeArrival).toISOString(),
    "2026-07-31T11:30:00.000Z",
  );
  assert.equal(hasTripArrived(arrival, beforeArrival), false);
  assert.equal(hasTripArrived(arrival, afterArrival), true);
  assert.equal(
    ethiopiaWallClockToInstant(arrival).toISOString(),
    "2026-07-31T09:00:00.000Z",
  );
});

test("only expired bookings without any payment history are deletable", () => {
  assert.deepEqual(
    bookingDeletionEligibility({ status: "EXPIRED", payments: [] }),
    { canDelete: true, reason: null },
  );
  assert.equal(
    bookingDeletionEligibility({
      status: "EXPIRED",
      payments: [{ status: "PENDING" }],
    }).canDelete,
    false,
  );
  assert.equal(
    bookingDeletionEligibility({
      status: "EXPIRED",
      payments: [{ status: "VERIFIED" }],
    }).canDelete,
    false,
  );
  assert.equal(
    bookingDeletionEligibility({ status: "PENDING", payments: [] }).canDelete,
    false,
  );
});

test("trip deletion permits only empty or expired-paymentless history", () => {
  assert.equal(tripDeletionEligibility("SCHEDULED", []).canDelete, true);
  assert.equal(
    tripDeletionEligibility("COMPLETED", [
      { status: "EXPIRED", payments: [] },
      { status: "EXPIRED", payments: [] },
    ]).canDelete,
    true,
  );

  const confirmed = tripDeletionEligibility("COMPLETED", [
    { status: "CONFIRMED", payments: [] },
  ]);
  assert.equal(confirmed.canDelete, false);
  assert.equal(confirmed.recommendedAction, "archive");

  const paid = tripDeletionEligibility("SCHEDULED", [
    { status: "CONFIRMED", payments: [{ status: "VERIFIED" }] },
  ]);
  assert.equal(paid.canDelete, false);
  assert.equal(paid.recommendedAction, "cancel");
  assert.equal(paid.refundRequiredCount, 1);
});

test("archived unsafe trips expose history instead of a delete action", () => {
  const archived = tripDeletionEligibility("ARCHIVED", [
    { status: "CANCELLED", payments: [{ status: "REFUNDED" }] },
  ]);
  assert.equal(archived.canDelete, false);
  assert.equal(archived.recommendedAction, "viewHistory");
});
