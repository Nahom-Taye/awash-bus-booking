import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "am"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {
    name: "NEXT_LOCALE",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 365,
    path: "/",
  },
});

export type AppLocale = (typeof routing.locales)[number];
