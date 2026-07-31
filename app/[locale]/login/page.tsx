import { redirect } from "next/navigation";
import { auth } from "@/auth";
import RoleLoginForm from "@/app/components/RoleLoginForm";
import type { AppLocale } from "@/i18n/routing";
import prisma from "@/lib/prisma";
import { safePassengerCallback } from "@/lib/passenger-journey";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LoginPage({
  params,
  searchParams,
}: LoginPageProps) {
  const [{ locale: requestedLocale }, query, session] = await Promise.all([
    params,
    searchParams,
    auth(),
  ]);
  const locale: AppLocale = requestedLocale === "am" ? "am" : "en";
  const rawCallback = query.callbackUrl;
  const callbackUrl = safePassengerCallback(
    typeof rawCallback === "string" ? rawCallback : null,
    locale,
  );
  let operatorBookingDenied = false;

  if (callbackUrl && session?.user?.id) {
    const databaseUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true },
    });

    if (
      databaseUser?.role === "PASSENGER" &&
      session.user.role === "PASSENGER"
    ) {
      redirect(callbackUrl);
    }

    operatorBookingDenied =
      databaseUser?.role === "OPERATOR" &&
      session.user.role === "OPERATOR";
  }

  return (
    <RoleLoginForm
      mode="passenger"
      callbackUrl={callbackUrl}
      operatorBookingDenied={operatorBookingDenied}
    />
  );
}
