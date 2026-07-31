import { getRequestConfig } from "next-intl/server";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  if (!requested || !hasLocale(routing.locales, requested)) {
    notFound();
  }

  const locale = requested as AppLocale;
  const messages =
    locale === "am"
      ? (await import("../messages/am.json")).default
      : (await import("../messages/en.json")).default;

  return {
    locale,
    timeZone: "Africa/Addis_Ababa",
    messages,
  };
});
