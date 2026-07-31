import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export default function HomeAuthActions() {
  const t = useTranslations("common");

  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link
        href="/login"
        className="hidden min-h-10 items-center justify-center rounded-lg border border-stone-300 bg-white px-4 text-sm font-semibold text-stone-700 transition hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 sm:inline-flex"
      >
        {t("login")}
      </Link>
      <Link
        href="/register"
        className="inline-flex min-h-10 items-center justify-center rounded-lg bg-awash-orange px-4 text-sm font-bold text-white transition hover:bg-awash-orange-dark focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2"
      >
        {t("signUp")}
      </Link>
    </div>
  );
}
