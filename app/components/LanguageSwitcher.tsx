"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { AppLocale } from "@/i18n/routing";

const OPTIONS: { value: AppLocale; label: string }[] = [
  { value: "en", label: "EN" },
  { value: "am", label: "አማርኛ" },
];

export default function LanguageSwitcher({
  compact = false,
}: {
  compact?: boolean;
}) {
  const locale = useLocale() as AppLocale;
  const pathname = usePathname();
  const router = useRouter();
  const t = useTranslations("common");

  function changeLocale(nextLocale: AppLocale) {
    if (nextLocale === locale) return;

    const query = window.location.search;
    const hash = window.location.hash;
    const nextPath = `${pathname}${query}${hash}`;

    // The locale preference must persist independently of client navigation.
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `NEXT_LOCALE=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    router.replace(nextPath, { locale: nextLocale });
  }

  return (
    <div
      aria-label={t("language")}
      className="inline-flex shrink-0 whitespace-nowrap rounded-lg border border-stone-200 bg-white p-1 shadow-sm"
      role="group"
    >
      {OPTIONS.map((option) => {
        const active = locale === option.value;

        return (
          <button
            key={option.value}
            type="button"
            aria-label={t("switchLanguage", { language: option.label })}
            aria-pressed={active}
            onClick={() => changeLocale(option.value)}
            className={`rounded-md font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 ${
              compact
                ? "min-h-7 px-2 py-1 text-xs"
                : "min-h-8 px-2.5 py-1.5 text-xs"
            } ${
              active
                ? "bg-awash-orange text-white"
                : "text-stone-600 hover:bg-orange-50 hover:text-awash-orange-dark"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
