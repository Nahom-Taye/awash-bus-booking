"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { getSession, signIn, signOut, useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import type { Role } from "@prisma/client";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { Link, useRouter } from "@/i18n/navigation";

type LoginMode = "passenger" | "operator";

type LoginForm = {
  email: string;
  password: string;
};

const roleDestinations: Record<Role, string> = {
  PASSENGER: "/passenger/dashboard",
  OPERATOR: "/operator/dashboard",
};

export default function RoleLoginForm({
  mode,
  callbackUrl = null,
  operatorBookingDenied = false,
}: {
  mode: LoginMode;
  callbackUrl?: string | null;
  operatorBookingDenied?: boolean;
}) {
  const router = useRouter();
  const { status } = useSession();
  const t = useTranslations("auth");
  const tCommon = useTranslations("common");
  const sessionClearStarted = useRef(false);
  const successfulLogin = useRef(false);
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sessionClearError, setSessionClearError] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const isOperator = mode === "operator";
  const role = isOperator ? "OPERATOR" : "PASSENGER";
  const provider = isOperator
    ? "operator-credentials"
    : "passenger-credentials";
  const invalidMessage = isOperator
    ? t("invalidOperator")
    : t("invalidPassenger");

  useEffect(() => {
    if (operatorBookingDenied) return;
    if (status === "unauthenticated") return;

    if (
      status !== "authenticated" ||
      successfulLogin.current ||
      sessionClearStarted.current
    ) {
      return;
    }

    sessionClearStarted.current = true;

    void signOut({ redirect: false })
      .then(() => {
        setForm({ email: "", password: "" });
        setError(null);
        router.refresh();
      })
      .catch(() => {
        sessionClearStarted.current = false;
        setSessionClearError(t("sessionClearError"));
      });
  }, [operatorBookingDenied, router, status, t]);

  function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError(invalidMessage);
      return;
    }

    setLoading(true);
    successfulLogin.current = true;

    try {
      const result = await signIn(provider, {
        email,
        password,
        redirect: false,
      });

      if (!result || result.error) {
        successfulLogin.current = false;
        setError(invalidMessage);
        return;
      }

      const session = await getSession();

      if (session?.user?.role !== role) {
        successfulLogin.current = false;
        await signOut({ redirect: false });
        setError(invalidMessage);
        return;
      }

      if (role === "PASSENGER") {
        if (callbackUrl) {
          window.location.assign(callbackUrl);
          return;
        } else {
          router.push(roleDestinations.PASSENGER);
        }
      } else {
        router.push(roleDestinations.OPERATOR);
      }

      router.refresh();
    } catch {
      successfulLogin.current = false;
      setError(invalidMessage);
    } finally {
      setLoading(false);
    }
  }

  if (operatorBookingDenied) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-12">
        <div className="awash-card w-full max-w-lg p-7 sm:p-8">
          <div className="awash-alert-error" role="alert">
            <h1 className="font-bold">{t("operatorBookingDeniedTitle")}</h1>
            <p className="mt-1">{t("operatorBookingDenied")}</p>
          </div>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <Link href="/operator/dashboard" className="awash-primary">
              {t("returnToOperatorDashboard")}
            </Link>
            <Link href="/" className="awash-secondary">
              {t("returnHome")}
            </Link>
          </div>
        </div>
      </main>
    );
  }

  if (status !== "unauthenticated") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-stone-100 px-4 py-12">
        <div className="awash-card w-full max-w-md p-8 text-center text-sm text-stone-600">
          {sessionClearError ?? t("preparingLogin")}
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
            <p className="awash-section-label">
              {isOperator ? t("operatorEyebrow") : t("passengerEyebrow")}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-stone-900">
              {isOperator ? t("operatorTitle") : t("passengerTitle")}
            </h1>
            <p className="mt-3 text-sm leading-6 text-stone-600">
              {isOperator
                ? t("operatorDescription")
                : t("passengerDescription")}
            </p>
            {!isOperator && callbackUrl && (
              <div className="mt-5 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
                {t("journeySignInMessage")}
              </div>
            )}

            {error && (
              <div className="awash-alert-error mt-6" role="alert">
                {error}
              </div>
            )}

            <div className="mt-7 space-y-5">
              <label htmlFor={`${mode}-email`} className="awash-label">
                {tCommon("email")}
                <input
                  id={`${mode}-email`}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className="awash-input"
                  placeholder={t("emailPlaceholder")}
                />
              </label>

              <label htmlFor={`${mode}-password`} className="awash-label">
                {tCommon("password")}
                <span className="relative block">
                  <input
                    id={`${mode}-password`}
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
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
              disabled={loading}
              className="awash-primary mt-7 w-full"
            >
              {loading
                ? t("loggingIn")
                : isOperator
                  ? t("operatorLoginButton")
                  : t("loginButton")}
            </button>

            <p className="mt-6 text-center text-sm text-stone-600">
              {isOperator ? t("travellingWithUs") : t("newPassenger")}{" "}
              <Link
                href={
                  isOperator
                    ? "/login"
                    : callbackUrl
                      ? {
                          pathname: "/register",
                          query: { callbackUrl },
                        }
                      : "/register"
                }
                className="font-bold text-awash-orange hover:text-awash-orange-dark"
              >
                {isOperator ? t("passengerLoginLink") : tCommon("signUp")}
              </Link>
            </p>
          </form>
        </div>
      </section>

      <aside className="relative hidden min-h-screen overflow-hidden bg-stone-900 lg:block">
        <Image
          src="/images/awash-bus-interior.jpg"
          alt={t("imageAlt")}
          fill
          priority
          sizes="50vw"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/10 to-transparent" />
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
