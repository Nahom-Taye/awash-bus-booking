import { stableCityValue } from "./ethiopian-cities.ts";
import { isDateOnly } from "./validation.ts";

export type JourneyLocale = "en" | "am";

export type JourneySearch = {
  origin: string;
  destination: string;
  date?: string;
};

const INTERNAL_ORIGIN = "https://awash.internal";
const CALLBACK_MAX_LENGTH = 1_000;
const ALLOWED_CALLBACK_PARAMS = new Set(["origin", "destination", "date"]);

function canonicalJourneySearch(
  search: JourneySearch,
): JourneySearch | null {
  const origin = stableCityValue(search.origin);
  const destination = stableCityValue(search.destination);
  const date = search.date?.trim() ?? "";

  if (
    !origin ||
    !destination ||
    origin === destination ||
    origin.length > 80 ||
    destination.length > 80 ||
    (date && !isDateOnly(date))
  ) {
    return null;
  }

  return {
    origin,
    destination,
    ...(date ? { date } : {}),
  };
}

export function buildPassengerJourneyPath(
  locale: JourneyLocale,
  search: JourneySearch,
): string {
  const canonical = canonicalJourneySearch(search);
  if (!canonical) {
    throw new Error("INVALID_PASSENGER_JOURNEY");
  }

  const params = new URLSearchParams({
    origin: canonical.origin,
    destination: canonical.destination,
  });
  if (canonical.date) params.set("date", canonical.date);

  return `/${locale}/passenger/dashboard?${params.toString()}`;
}

export function safePassengerCallback(
  value: string | null | undefined,
  locale: JourneyLocale,
): string | null {
  if (
    !value ||
    value.length > CALLBACK_MAX_LENGTH ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    /[\u0000-\u001F\u007F]/.test(value)
  ) {
    return null;
  }

  let callback: URL;
  try {
    callback = new URL(value, INTERNAL_ORIGIN);
  } catch {
    return null;
  }

  if (
    callback.origin !== INTERNAL_ORIGIN ||
    callback.hash ||
    !/^\/(?:en|am)\/passenger\/dashboard\/?$/.test(callback.pathname)
  ) {
    return null;
  }

  for (const key of callback.searchParams.keys()) {
    if (
      !ALLOWED_CALLBACK_PARAMS.has(key) ||
      callback.searchParams.getAll(key).length !== 1
    ) {
      return null;
    }
  }

  const canonical = canonicalJourneySearch({
    origin: callback.searchParams.get("origin") ?? "",
    destination: callback.searchParams.get("destination") ?? "",
    date: callback.searchParams.get("date") ?? "",
  });

  return canonical ? buildPassengerJourneyPath(locale, canonical) : null;
}
