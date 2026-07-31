import {
  ETHIOPIAN_CITIES,
  cityByValue,
  stableCityValue,
} from "@/lib/ethiopian-cities";



export const CITIES = ETHIOPIAN_CITIES.map((city) => ({
  id: city.value,
  databaseValue: city.value,
  key: city.value,
}));

export type CityId = (typeof CITIES)[number]["id"];
export type CityKey = string;

export function cityById(value: string) {
  const city = cityByValue(value);
  return city
    ? { id: city.value, databaseValue: city.value, key: city.value }
    : undefined;
}

export const cityByDatabaseValue = cityById;
export const normalizeCityId = stableCityValue;
export const cityDatabaseValue = stableCityValue;
