export type SupportedLocale = "en" | "am";

export type EthiopianCity = {
  value: string;
  en: string;
  am: string;
};

export const ETHIOPIAN_CITIES: readonly EthiopianCity[] = [
  { value: "addis-ababa", en: "Addis Ababa", am: "አዲስ አበባ" },
  { value: "adama", en: "Adama", am: "አዳማ" },
  { value: "assela", en: "Assela", am: "አሰላ" },
  { value: "awash", en: "Awash", am: "አዋሽ" },
  { value: "bahir-dar", en: "Bahir Dar", am: "ባሕር ዳር" },
  { value: "bule-hora", en: "Bule Hora", am: "ቡሌ ሆራ" },
  { value: "debre-birhan", en: "Debre Birhan", am: "ደብረ ብርሃን" },
  { value: "debre-markos", en: "Debre Markos", am: "ደብረ ማርቆስ" },
  { value: "dessie", en: "Dessie", am: "ደሴ" },
  { value: "dilla", en: "Dilla", am: "ዲላ" },
  { value: "dire-dawa", en: "Dire Dawa", am: "ድሬ ዳዋ" },
  { value: "gondar", en: "Gondar", am: "ጎንደር" },
  { value: "harar", en: "Harar", am: "ሐረር" },
  { value: "hawassa", en: "Hawassa", am: "ሀዋሳ" },
  { value: "jimma", en: "Jimma", am: "ጅማ" },
  { value: "mekelle", en: "Mekelle", am: "መቀሌ" },
  { value: "nekemte", en: "Nekemte", am: "ነቀምት" },
  { value: "shashamane", en: "Shashamane", am: "ሻሸመኔ" },
  { value: "arba-minch", en: "Arba Minch", am: "አርባ ምንጭ" },
  { value: "yirga-cheffe", en: "Yirga Cheffe", am: "ይርጋ ጨፌ" },
] as const;

export const OTHER_CITY_VALUE = "__other__";

const CITY_VALUE_ALIASES: Readonly<Record<string, string>> = {
  "adiss-ababa": "addis-ababa",
};

export function normalizeCityValue(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function cityByValue(value: string): EthiopianCity | undefined {
  const normalized = stableCityValue(value);
  return ETHIOPIAN_CITIES.find(
    (city) =>
      city.value === normalized ||
      normalizeCityValue(city.en) === normalized,
  );
}

export function stableCityValue(value: string): string {
  const normalized = normalizeCityValue(value);
  return CITY_VALUE_ALIASES[normalized] ?? normalized;
}

export function cityKeyCandidates(value: string): string[] {
  const canonical = stableCityValue(value);
  const candidates = new Set([canonical]);

  for (const [alias, target] of Object.entries(CITY_VALUE_ALIASES)) {
    if (target === canonical) candidates.add(alias);
  }

  return [...candidates];
}

export function formatEnglishCityName(value: string): string {
  const normalizedSpacing = value
    .normalize("NFKC")
    .trim()
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ");

  return normalizedSpacing
    .split(" ")
    .map((part) =>
      part
        ? `${part.charAt(0).toLocaleUpperCase("en")}${part
            .slice(1)
            .toLocaleLowerCase("en")}`
        : "",
    )
    .join(" ");
}

export function cleanCityLabel(value: string): string {
  return value.normalize("NFKC").trim().replace(/\s+/g, " ");
}

export function cityLabel(
  value: string,
  locale: string,
  labels?: { en?: string | null; am?: string | null },
): string {
  const city = cityByValue(value);
  const selectedLocale: SupportedLocale = locale === "am" ? "am" : "en";

  if (city) return city[selectedLocale];

  const localizedCustom =
    selectedLocale === "am" ? labels?.am?.trim() : labels?.en?.trim();
  return localizedCustom || labels?.en?.trim() || value;
}

export function citySearchText(city: EthiopianCity): string {
  return `${city.en} ${city.am} ${city.value}`.toLocaleLowerCase();
}
