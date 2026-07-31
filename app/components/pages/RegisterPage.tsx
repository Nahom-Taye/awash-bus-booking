"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { Link, useRouter } from "@/i18n/navigation";
import { readApiErrorCode } from "@/lib/api-client";

interface RegisterForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

const EMPTY_FORM: RegisterForm = {
  fullName: "",
  email: "",
  phone: "",
  password: "",
};

export default function RegisterPage({
  callbackUrl = null,
}: {
  callbackUrl?: string | null;
}) {
  const router = useRouter();
  const { status } = useSession();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const sessionClearStarted = useRef(false);
  const [form, setForm] = useState<RegisterForm>(EMPTY_FORM);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionClearError, setSessionClearError] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (status === "unauthenticated") return;
    if (status !== "authenticated" || sessionClearStarted.current) return;

    sessionClearStarted.current = true;

    void signOut({ redirect: false })
      .then(() => {
        setForm(EMPTY_FORM);
        setError(null);
        setSuccess(null);
        router.refresh();
      })
      .catch(() => {
        sessionClearStarted.current = false;
        setSessionClearError(t("sessionClearError"));
      });
  }, [router, status, t]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const code = await readApiErrorCode(response);
        setError(tErrors.has(code) ? tErrors(code) : tErrors("UNEXPECTED_ERROR"));
        return;
      }

      setForm(EMPTY_FORM);
      setSuccess(t("registrationSuccess"));
      await new Promise((resolve) => window.setTimeout(resolve, 1000));
      router.push(
        callbackUrl
          ? {
              pathname: "/login",
              query: { callbackUrl },
            }
          : "/login",
      );
    } catch {
      setError(tErrors("UNEXPECTED_ERROR"));
    } finally {
      setLoading(false);
    }
  }

  if (status !== "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-12">
        <div className="awash-card w-full max-w-md p-8 text-center text-sm text-stone-600">
          {sessionClearError ?? t("preparingRegistration")}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-stone-100 lg:grid lg:grid-cols-2">
      <section className="flex min-h-screen flex-col">
        <div className="flex items-center justify-between gap-4 px-5 py-5 sm:px-8">
          <Link
            href="/"
            className="text-sm font-extrabold tracking-tight text-stone-900 sm:text-base"
          >
            AWASH BUS <span className="text-stone-300">|</span>{" "}
            <span className="text-awash-orange">አዋሽ ባስ</span>
          </Link>
          <LanguageSwitcher />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 py-10 sm:px-8">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8"
          >
            <h1 className="text-3xl font-bold tracking-tight text-stone-900">
              {t("registerTitle")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {t("registerDescription")}
            </p>

            {error && (
              <div className="awash-alert-error mt-6" role="alert">
                {error}
              </div>
            )}
            {success && (
              <div className="awash-alert-success mt-6" role="status">
                {success}
              </div>
            )}

            <div className="mt-7 space-y-5">
              <label htmlFor="fullName" className="awash-label">
                {tCommon("fullName")}
                <input
                  id="fullName"
                  name="fullName"
                  type="text"
                  autoComplete="name"
                  required
                  maxLength={120}
                  value={form.fullName}
                  onChange={handleChange}
                  className="awash-input"
                  placeholder={t("namePlaceholder")}
                />
              </label>

              <label htmlFor="email" className="awash-label">
                {tCommon("email")}
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={form.email}
                  onChange={handleChange}
                  className="awash-input"
                  placeholder={t("emailPlaceholder")}
                />
              </label>

              <label htmlFor="phone" className="awash-label">
                {tCommon("phone")}
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  required
                  maxLength={40}
                  value={form.phone}
                  onChange={handleChange}
                  className="awash-input"
                  placeholder={t("phonePlaceholder")}
                />
              </label>

              <label htmlFor="password" className="awash-label">
                {tCommon("password")}
                <span className="relative block">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    required
                    minLength={8}
                    maxLength={72}
                    value={form.password}
                    onChange={handleChange}
                    className="awash-input pr-24"
                    placeholder={t("passwordPlaceholder")}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-2 right-2 mt-2 rounded-md px-2 text-xs font-semibold text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange"
                  >
                    {showPassword ? t("hidePassword") : t("showPassword")}
                  </button>
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={loading || Boolean(success)}
              className="awash-primary mt-7 w-full"
            >
              {loading ? t("creatingAccount") : t("createAccount")}
            </button>

            <p className="mt-6 text-center text-sm text-stone-600">
              {t("alreadyRegistered")}{" "}
              <Link
                href={
                  callbackUrl
                    ? {
                        pathname: "/login",
                        query: { callbackUrl },
                      }
                    : "/login"
                }
                className="font-bold text-awash-orange hover:text-awash-orange-dark"
              >
                {t("signInLink")}
              </Link>
            </p>
          </form>
        </div>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-stone-900 lg:block">
        <Image
          src="/images/awash-bus-exterior.jpg"
          alt={t("imageAlt")}
          fill
          priority
          sizes="50vw"
          className="object-contain"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/90 via-transparent to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-12 text-white">
          <p className="max-w-lg text-3xl font-bold">{t("imageTitle")}</p>
          <p className="mt-3 max-w-lg leading-7 text-stone-200">
            {t("imageText")}
          </p>
        </div>
      </aside>
    </main>
  );
}
