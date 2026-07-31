import {
  cityByValue,
  cleanCityLabel,
  formatEnglishCityName,
  stableCityValue,
} from "./ethiopian-cities.ts";

export type ServedCity = {
  value: string;
  en: string;
  am: string;
};

export type ServedRoute = {
  id: string;
  origin: ServedCity;
  destination: ServedCity;
};

export type ServedRouteRow = {
  id: string;
  originKey: string;
  destinationKey: string;
  originEn: string | null;
  originAm: string | null;
  destinationEn: string | null;
  destinationAm: string | null;
};

function cityPayload(
  value: string,
  en: string | null,
  am: string | null,
): ServedCity {
  const canonicalValue = stableCityValue(value || en || "");
  const knownCity = cityByValue(canonicalValue);
  const englishLabel = knownCity?.en ?? en ?? value;
  const amharicLabel =
    knownCity?.am ??
    (am?.trim() ? cleanCityLabel(am) : formatEnglishCityName(en ?? value));

  return {
    value: canonicalValue,
    en: formatEnglishCityName(englishLabel),
    am: cleanCityLabel(amharicLabel),
  };
}

export function normalizeServedRoutes(
  rows: readonly ServedRouteRow[],
): ServedRoute[] {
  const uniqueRoutes = new Map<string, ServedRoute>();

  for (const row of rows) {
    const origin = cityPayload(row.originKey, row.originEn, row.originAm);
    const destination = cityPayload(
      row.destinationKey,
      row.destinationEn,
      row.destinationAm,
    );

    if (
      !origin.value ||
      !destination.value ||
      origin.value === destination.value
    ) {
      continue;
    }

    const pairKey = `${origin.value}:${destination.value}`;
    if (uniqueRoutes.has(pairKey)) continue;

    uniqueRoutes.set(pairKey, {
      id: row.id,
      origin,
      destination,
    });
  }

  return [...uniqueRoutes.values()].sort(
    (left, right) =>
      left.origin.en.localeCompare(right.origin.en, "en", {
        sensitivity: "base",
      }) ||
      left.destination.en.localeCompare(right.destination.en, "en", {
        sensitivity: "base",
      }),
  );
}

export function uniqueOrigins(routes: readonly ServedRoute[]): ServedCity[] {
  const unique = new Map<string, ServedCity>();
  for (const route of routes) unique.set(route.origin.value, route.origin);
  return [...unique.values()];
}

export function destinationsForOrigin(
  routes: readonly ServedRoute[],
  origin: string,
): ServedCity[] {
  const canonicalOrigin = stableCityValue(origin);
  const unique = new Map<string, ServedCity>();

  for (const route of routes) {
    if (route.origin.value === canonicalOrigin) {
      unique.set(route.destination.value, route.destination);
    }
  }

  return [...unique.values()];
}
