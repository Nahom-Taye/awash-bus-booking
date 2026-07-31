import Image from "next/image";
import { useTranslations } from "next-intl";
import ContactSection from "@/app/components/ContactSection";
import FAQSection from "@/app/components/FAQSection";
import HomeAuthActions from "@/app/components/HomeAuthActions";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";

const TRUST_ITEMS = [
  ["safeTitle", "safeText", "✓"],
  ["comfortTitle", "comfortText", "↗"],
  ["wifiTitle", "wifiText", "⌁"],
  ["serviceTitle", "serviceText", "★"],
] as const;

const STANDARDS = ["one", "two", "three", "four"] as const;

export default function Home() {
  const t = useTranslations("home");
  const nav = useTranslations("nav");

  return (
    <div className="min-h-screen bg-white text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white/95 backdrop-blur">
        <div className="awash-container flex min-h-18 items-center justify-between gap-4">
          <Link
            href="/"
            aria-label={nav("home")}
            className="shrink-0 text-sm font-extrabold tracking-tight text-stone-900 sm:text-base"
          >
            AWASH BUS{" "}
            <span className="hidden sm:inline">
              <span className="text-stone-300">|</span>{" "}
              <span className="text-awash-orange">አዋሽ ባስ</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-6 text-sm font-semibold text-stone-600 lg:flex">
            <a className="hover:text-awash-orange" href="#services">
              {nav("services")}
            </a>
            <a className="hover:text-awash-orange" href="#safety">
              {nav("safety")}
            </a>
            <a className="hover:text-awash-orange" href="#faq">
              {nav("faq")}
            </a>
            <a className="hover:text-awash-orange" href="#contact">
              {nav("contact")}
            </a>
          </nav>

          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <HomeAuthActions />
          </div>
        </div>
        <nav className="awash-container flex gap-5 overflow-x-auto border-t border-stone-100 py-2 text-xs font-semibold text-stone-600 lg:hidden">
          <a className="shrink-0 hover:text-awash-orange" href="#services">
            {nav("services")}
          </a>
          <a className="shrink-0 hover:text-awash-orange" href="#safety">
            {nav("safety")}
          </a>
          <a className="shrink-0 hover:text-awash-orange" href="#faq">
            {nav("faq")}
          </a>
          <a className="shrink-0 hover:text-awash-orange" href="#contact">
            {nav("contact")}
          </a>
        </nav>
      </header>

      <main>
        <section className="overflow-hidden bg-[#fffaf6]">
          <div className="mx-auto grid w-full max-w-[1440px] lg:grid-cols-[0.9fr_1.1fr]">
            <div className="flex min-h-[520px] flex-col justify-center px-5 py-16 sm:px-10 lg:min-h-[640px] lg:px-16 xl:px-20">
              <p className="awash-section-label">{t("eyebrow")}</p>
              <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-[1.12] tracking-[-0.035em] text-stone-900 sm:text-5xl lg:text-6xl">
                {t("headline")}
              </h1>
              <p className="mt-6 max-w-xl text-base leading-8 text-stone-600 sm:text-lg">
                {t("description")}
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href="/login" className="awash-primary">
                  {t("primaryCta")}
                </Link>
                <a href="#services" className="awash-secondary">
                  {t("secondaryCta")}
                </a>
              </div>
            </div>

            <div className="relative min-h-[400px] overflow-hidden bg-stone-100 lg:min-h-[640px]">
              <Image
                src="/images/awash-bus-exterior.jpg"
                alt={t("heroAlt")}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 58vw"
                className="object-contain object-center"
              />
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-stone-950/70 to-transparent px-6 pb-6 pt-20 text-sm font-semibold text-white sm:px-8">
                {t("heroCaption")}
              </div>
            </div>
          </div>
        </section>

        <section
          id="services"
          className="scroll-mt-24 border-t border-stone-200 bg-white py-18 sm:py-22"
        >
          <div className="awash-container">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TRUST_ITEMS.map(([title, text, symbol]) => (
                <article
                  key={title}
                  className="rounded-xl border border-stone-200 bg-white p-6"
                >
                  <span
                    aria-hidden="true"
                    className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-50 font-bold text-awash-orange"
                  >
                    {symbol}
                  </span>
                  <h2 className="mt-5 font-bold text-stone-900">
                    {t(`trust.${title}`)}
                  </h2>
                  <p className="mt-2 text-sm leading-6 text-stone-600">
                    {t(`trust.${text}`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="bg-stone-100 py-20 sm:py-24">
          <div className="awash-container grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl bg-stone-200 shadow-sm">
              <Image
                src="/images/awash-bus-interior.jpg"
                alt={t("comfort.imageAlt")}
                fill
                sizes="(max-width: 1024px) 100vw, 52vw"
                className="object-cover"
              />
              <p className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-5 pb-5 pt-16 text-sm font-semibold text-white">
                {t("comfort.imageCaption")}
              </p>
            </div>
            <div>
              <p className="awash-section-label">{t("comfort.eyebrow")}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                {t("comfort.title")}
              </h2>
              <p className="mt-5 max-w-xl leading-8 text-stone-600">
                {t("comfort.description")}
              </p>
            </div>
          </div>
        </section>

        <section
          id="safety"
          className="scroll-mt-24 border-y border-stone-200 bg-[#fffaf6] py-20 sm:py-24"
        >
          <div className="awash-container grid gap-10 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <p className="awash-section-label">{t("standards.eyebrow")}</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight text-stone-900 sm:text-4xl">
                {t("standards.title")}
              </h2>
              <p className="mt-4 leading-7 text-stone-600">
                {t("standards.description")}
              </p>
            </div>
            <div className="overflow-hidden rounded-xl border border-stone-200 bg-white">
              {STANDARDS.map((item, index) => (
                <article
                  key={item}
                  className={`grid gap-3 p-6 sm:grid-cols-[54px_0.8fr_1.2fr] sm:gap-6 ${
                    index > 0 ? "border-t border-stone-200" : ""
                  }`}
                >
                  <span className="text-sm font-bold text-awash-orange">
                    0{index + 1}
                  </span>
                  <h3 className="font-bold text-stone-900">
                    {t(`standards.${item}Title`)}
                  </h3>
                  <p className="text-sm leading-6 text-stone-600">
                    {t(`standards.${item}Text`)}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <FAQSection />
        <ContactSection />
      </main>

      <footer className="bg-stone-950 text-stone-300">
        <div className="awash-container py-12">
          <div className="grid gap-8 border-b border-white/10 pb-9 md:grid-cols-[1fr_auto]">
            <div className="max-w-lg">
              <p className="font-extrabold text-white">
                AWASH BUS <span className="text-stone-600">|</span>{" "}
                <span className="text-awash-orange-light">አዋሽ ባስ</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-stone-400">
                {t("footer.description")}
              </p>
            </div>
            <nav
              aria-label={nav("footerLabel")}
              className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm"
            >
              <a className="hover:text-white" href="#services">
                {nav("services")}
              </a>
              <a className="hover:text-white" href="#faq">
                {nav("faq")}
              </a>
              <a className="hover:text-white" href="#contact">
                {nav("contact")}
              </a>
            </nav>
          </div>
          <div className="flex flex-col items-start justify-between gap-4 pt-6 text-sm sm:flex-row sm:items-center">
            <p className="text-stone-500">{t("footer.copyright")}</p>
            <Link
              href="/operator-login"
              className="text-stone-400 transition hover:text-awash-orange-light"
            >
              {nav("operatorLogin")}
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
