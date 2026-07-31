import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPassengerJourneyPath,
  safePassengerCallback,
} from "../lib/passenger-journey.ts";
import {
  destinationsForOrigin,
  normalizeServedRoutes,
  uniqueOrigins,
  type ServedRouteRow,
} from "../lib/served-routes.ts";

const route = (
  id: string,
  originKey: string,
  destinationKey: string,
): ServedRouteRow => ({
  id,
  originKey,
  destinationKey,
  originEn: null,
  originAm: null,
  destinationEn: null,
  destinationAm: null,
});

test("served routes canonicalize spelling, casing, slugs, and spacing", () => {
  const routes = normalizeServedRoutes([
    route("one", "Addis Ababa", "hawassa"),
    route("two", "addis-ababa", "HAWASSA"),
    route("three", "  adiss   ababa  ", " hawassa "),
  ]);

  assert.equal(routes.length, 1);
  assert.deepEqual(routes[0]?.origin, {
    value: "addis-ababa",
    en: "Addis Ababa",
    am: "አዲስ አበባ",
  });
  assert.equal(routes[0]?.destination.en, "Hawassa");
  assert.deepEqual(uniqueOrigins(routes).map((city) => city.value), [
    "addis-ababa",
  ]);
});

test("destination choices are unique and depend on the selected origin", () => {
  const routes = normalizeServedRoutes([
    route("one", "addis-ababa", "hawassa"),
    route("two", "addis-ababa", "dessie"),
    route("duplicate", "ADDis   Ababa", "DESSIE"),
    route("three", "awash", "adama"),
  ]);

  assert.deepEqual(
    destinationsForOrigin(routes, "addis ababa").map((city) => city.value),
    ["dessie", "hawassa"],
  );
  assert.deepEqual(
    destinationsForOrigin(routes, "awash").map((city) => city.value),
    ["adama"],
  );
});

test("localized passenger callbacks preserve the complete journey", () => {
  assert.equal(
    buildPassengerJourneyPath("en", {
      origin: "adiss-ababa",
      destination: "hawassa",
      date: "2026-08-15",
    }),
    "/en/passenger/dashboard?origin=addis-ababa&destination=hawassa&date=2026-08-15",
  );
  assert.equal(
    buildPassengerJourneyPath("am", {
      origin: "addis ababa",
      destination: "hawassa",
    }),
    "/am/passenger/dashboard?origin=addis-ababa&destination=hawassa",
  );
});

test("callback validation only accepts canonical internal journey results", () => {
  const englishCallback =
    "/en/passenger/dashboard?origin=adiss-ababa&destination=hawassa&date=2026-08-15";

  assert.equal(
    safePassengerCallback(englishCallback, "am"),
    "/am/passenger/dashboard?origin=addis-ababa&destination=hawassa&date=2026-08-15",
  );
  assert.equal(
    safePassengerCallback(
      "/en/passenger/dashboard?origin=addis-ababa&destination=addis-ababa",
      "en",
    ),
    null,
  );
  assert.equal(safePassengerCallback("https://evil.example", "en"), null);
  assert.equal(
    safePassengerCallback(
      "//evil.example/en/passenger/dashboard?origin=awash&destination=adama",
      "en",
    ),
    null,
  );
  assert.equal(
    safePassengerCallback(
      "/en/passenger/dashboard?origin=awash&destination=adama&next=https://evil.example",
      "en",
    ),
    null,
  );
  assert.equal(
    safePassengerCallback(
      "/en/operator/dashboard?origin=awash&destination=adama",
      "en",
    ),
    null,
  );
});
