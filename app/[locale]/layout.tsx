import type { Metadata } from "next";
import { Inter, Noto_Sans_Ethiopic } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { notFound } from "next/navigation";
import Providers from "@/app/providers";
import { routing, type AppLocale } from "@/i18n/routing";
import "../globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-english",
  display: "swap",
});

const notoSansEthiopic = Noto_Sans_Ethiopic({
  subsets: ["ethiopic"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-amharic",
  display: "swap",
});

async function loadMessages(locale: AppLocale) {
  if (locale === "am") {
    return (await import("../../messages/am.json")).default;
  }

  return (await import("../../messages/en.json")).default;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return {
    title: locale === "am" ? "አዋሽ ባስ" : "Awash Bus",
    description:
      locale === "am"
        ? "በአዋሽ ባስ የአውቶቡስ ትኬትዎን በመስመር ላይ ይያዙ"
        : "Search routes, choose seats, and book Awash Bus tickets online.",
  };
}

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);
  const messages = await loadMessages(locale);

  return (
    <html
      lang={locale}
      dir="ltr"
      className={`${inter.variable} ${notoSansEthiopic.variable} h-full`}
    >
      <body className="min-h-full flex flex-col antialiased">
        <NextIntlClientProvider
          key={locale}
          locale={locale}
          messages={messages}
          timeZone="Africa/Addis_Ababa"
        >
          <Providers>{children}</Providers>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
