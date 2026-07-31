import RegisterPage from "@/app/components/pages/RegisterPage";
import type { AppLocale } from "@/i18n/routing";
import { safePassengerCallback } from "@/lib/passenger-journey";

type RegisterRouteProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function RegisterRoute({
  params,
  searchParams,
}: RegisterRouteProps) {
  const [{ locale: requestedLocale }, query] = await Promise.all([
    params,
    searchParams,
  ]);
  const locale: AppLocale = requestedLocale === "am" ? "am" : "en";
  const rawCallback = query.callbackUrl;
  const callbackUrl = safePassengerCallback(
    typeof rawCallback === "string" ? rawCallback : null,
    locale,
  );

  return <RegisterPage callbackUrl={callbackUrl} />;
}
