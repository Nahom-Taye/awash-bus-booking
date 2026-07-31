"use client";

import Image from "next/image";
import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { Link } from "@/i18n/navigation";
import { readApiErrorCode } from "@/lib/api-client";
import { cityLabel } from "@/lib/ethiopian-cities";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
type PaymentMethod = "TELEBIRR" | "CBE";
type PaymentStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "REFUNDED";

type PaymentRecord = {
  id: string;
  method: PaymentMethod;
  amount: string;
  currency: string;
  transactionReference: string;
  senderName: string;
  senderIdentifier: string;
  status: PaymentStatus;
  rejectionReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CheckoutData = {
  booking: {
    id: string;
    seatNumber: number;
    fullName: string;
    phone: string;
    email: string | null;
    status: BookingStatus;
    holdExpiresAt: string | null;
    createdAt: string;
    trip: {
      id: string;
      date: string;
      departureTime: string;
      arrivalTime: string;
      price: string;
      status: TripStatus;
      route: {
        origin: string;
        destination: string;
        originEn: string | null;
        originAm: string | null;
        destinationEn: string | null;
        destinationAm: string | null;
      };
      bus: {
        plateNumber: string;
      };
    };
    payments: PaymentRecord[];
  };
  paymentConfiguration: {
    telebirr: {
      available: boolean;
      recipientName: string | null;
      merchantNumber: string | null;
    };
    cbe: {
      available: boolean;
      accountHolderName: string | null;
      accountNumber: string | null;
    };
  };
  paymentWindowMinutes: number;
};

function formatCountdown(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function CheckoutPage({
  params,
}: {
  params: Promise<{ bookingId: string }>;
}) {
  const { bookingId } = use(params);
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("checkout");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tPaymentStatus = useTranslations("paymentStatus");
  const [data, setData] = useState<CheckoutData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<PaymentMethod | null>(null);
  const [transactionReference, setTransactionReference] = useState("");
  const [senderName, setSenderName] = useState("");
  const [senderIdentifier, setSenderIdentifier] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(0);

  const translateError = useCallback(
    (code: string, fallback: string) =>
      tErrors.has(code) ? tErrors(code) : tErrors(fallback),
    [tErrors],
  );

  const fetchCheckout = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/passenger/bookings/${bookingId}/checkout`,
        { cache: "no-store" },
      );
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(translateError(code, "LOAD_CHECKOUT_FAILED"));
      }
      const checkoutData = (await response.json()) as CheckoutData;
      setData(checkoutData);
      setMethod((current) => {
        if (
          current === "TELEBIRR" &&
          checkoutData.paymentConfiguration.telebirr.available
        ) {
          return current;
        }
        if (
          current === "CBE" &&
          checkoutData.paymentConfiguration.cbe.available
        ) {
          return current;
        }
        return null;
      });
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : tErrors("LOAD_CHECKOUT_FAILED"),
      );
    } finally {
      setLoading(false);
    }
  }, [bookingId, tErrors, translateError]);

  useEffect(() => {
    queueMicrotask(() => void fetchCheckout());
  }, [fetchCheckout]);

  const holdExpiresAt = data?.booking.holdExpiresAt ?? null;
  useEffect(() => {
    if (!holdExpiresAt) return;

    let didExpire = false;
    const updateCountdown = () => {
      const next = Math.max(
        0,
        Math.ceil(
          (new Date(holdExpiresAt).getTime() - Date.now()) / 1_000,
        ),
      );
      setRemainingSeconds(next);
      if (next === 0 && !didExpire) {
        didExpire = true;
        void fetchCheckout();
      }
    };
    updateCountdown();
    const timer = window.setInterval(updateCountdown, 1_000);
    return () => window.clearInterval(timer);
  }, [fetchCheckout, holdExpiresAt]);

  const latestPayment = data?.booking.payments[0] ?? null;
  const canSubmit =
    data?.booking.status === "PENDING" &&
    data.booking.trip.status === "SCHEDULED" &&
    Boolean(data.booking.holdExpiresAt) &&
    remainingSeconds > 0 &&
    latestPayment?.status !== "PENDING" &&
    latestPayment?.status !== "VERIFIED";

  const paymentState = useMemo(() => {
    if (!data) return "AWAITING_PAYMENT" as const;
    if (data.booking.status === "EXPIRED") return "EXPIRED" as const;
    if (data.booking.status === "CONFIRMED") return "VERIFIED" as const;
    if (latestPayment) return latestPayment.status;
    return "AWAITING_PAYMENT" as const;
  }, [data, latestPayment]);

  const localizedCity = useCallback(
    (
      value: string,
      en: string | null,
      am: string | null,
    ) => cityLabel(value, locale, { en, am }),
    [locale],
  );
  const formatDate = (value: string) =>
    format.dateTime(new Date(value), {
      year: "numeric",
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    });
  const formatTime = (value: string) =>
    format.dateTime(new Date(value), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "UTC",
    });
  const formatDateTime = (value: string) =>
    format.dateTime(new Date(value), {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const formatPrice = (value: string | number) =>
    format.number(Number(value), {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: 2,
    });

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!method || !canSubmit) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitted(false);

    try {
      const response = await fetch("/api/passenger/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId,
          method,
          transactionReference,
          senderName,
          senderIdentifier,
        }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          translateError(code, "SUBMIT_PAYMENT_FAILED"),
        );
      }

      setSubmitted(true);
      setTransactionReference("");
      setSenderName("");
      setSenderIdentifier("");
      await fetchCheckout();
    } catch (submissionError) {
      setSubmitError(
        submissionError instanceof Error
          ? submissionError.message
          : tErrors("SUBMIT_PAYMENT_FAILED"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="min-h-screen bg-stone-100">
        <CheckoutHeader />
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-stone-600">
          {t("loading")}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-stone-100">
        <CheckoutHeader />
        <main className="awash-container py-10">
          <div className="awash-alert-error mx-auto max-w-lg text-center">
            <p>{error ?? tErrors("LOAD_CHECKOUT_FAILED")}</p>
            <button
              type="button"
              onClick={() => void fetchCheckout()}
              className="mt-3 font-semibold underline"
            >
              {tCommon("retry")}
            </button>
          </div>
        </main>
      </div>
    );
  }

  const { booking, paymentConfiguration } = data;
  const methodConfiguration =
    method === "TELEBIRR"
      ? paymentConfiguration.telebirr
      : method === "CBE"
        ? paymentConfiguration.cbe
        : null;
  const hasAvailablePaymentMethod =
    paymentConfiguration.telebirr.available ||
    paymentConfiguration.cbe.available;

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <CheckoutHeader />
      <main className="awash-container py-7 sm:py-10">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="awash-section-label">{t("eyebrow")}</p>
            <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
              {t("title")}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
              {t("description")}
            </p>
          </div>
          <PaymentStatusBadge
            label={tPaymentStatus(paymentState)}
            status={paymentState}
          />
        </div>

        {booking.holdExpiresAt && canSubmit && (
          <div className="mt-6 flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-bold text-amber-950">
                {t("seatHeld")}
              </p>
              <p className="mt-1 text-sm text-amber-900">
                {t("seatHeldDescription", {
                  minutes: data.paymentWindowMinutes,
                })}
              </p>
            </div>
            <span
              aria-label={t("timeRemaining")}
              className="font-mono text-2xl font-black tabular-nums text-amber-950"
            >
              {formatCountdown(remainingSeconds)}
            </span>
          </div>
        )}

        {paymentState === "PENDING" && (
          <div className="awash-alert-success mt-6">
            <p className="font-bold">{t("awaitingVerificationTitle")}</p>
            <p className="mt-1 text-sm">{t("awaitingVerificationDescription")}</p>
          </div>
        )}
        {submitted && (
          <p className="awash-alert-success mt-6" role="status">
            {t("submitted")}
          </p>
        )}
        {paymentState === "VERIFIED" && (
          <div className="awash-alert-success mt-6">
            <p className="font-bold">{t("verifiedTitle")}</p>
            <p className="mt-1 text-sm">{t("verifiedDescription")}</p>
          </div>
        )}
        {paymentState === "REJECTED" && latestPayment && (
          <div className="awash-alert-error mt-6">
            <p className="font-bold">{t("rejectedTitle")}</p>
            <p className="mt-1 text-sm">
              {latestPayment.rejectionReason ?? t("noRejectionReason")}
            </p>
            {canSubmit && (
              <p className="mt-2 text-sm font-semibold">
                {t("retryPayment")}
              </p>
            )}
          </div>
        )}
        {paymentState === "EXPIRED" && (
          <div className="awash-alert-error mt-6">
            <p className="font-bold">{t("expiredTitle")}</p>
            <p className="mt-1 text-sm">{t("expiredDescription")}</p>
          </div>
        )}

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
          <section className="awash-card p-5 sm:p-6">
            <h2 className="text-xl font-bold">{t("bookingSummary")}</h2>
            <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <SummaryItem label={tCommon("route")}>
                {localizedCity(
                  booking.trip.route.origin,
                  booking.trip.route.originEn,
                  booking.trip.route.originAm,
                )}{" "}
                <span className="text-awash-orange">→</span>{" "}
                {localizedCity(
                  booking.trip.route.destination,
                  booking.trip.route.destinationEn,
                  booking.trip.route.destinationAm,
                )}
              </SummaryItem>
              <SummaryItem label={t("travelDate")}>
                {formatDate(booking.trip.date)}
              </SummaryItem>
              <SummaryItem label={t("travelTimes")}>
                {formatTime(booking.trip.departureTime)} –{" "}
                {formatTime(booking.trip.arrivalTime)}
              </SummaryItem>
              <SummaryItem label={t("busPlate")}>
                {booking.trip.bus.plateNumber}
              </SummaryItem>
              <SummaryItem label={tCommon("seat")}>
                {booking.seatNumber}
              </SummaryItem>
              <SummaryItem label={tCommon("passenger")}>
                {booking.fullName}
              </SummaryItem>
              <SummaryItem label={t("totalPrice")}>
                <span className="text-lg font-black text-awash-orange">
                  {formatPrice(booking.trip.price)}
                </span>
              </SummaryItem>
            </dl>
          </section>

          <section className="awash-card p-5 sm:p-6">
            <h2 className="text-xl font-bold">{t("chooseMethod")}</h2>
            <p className="mt-1 text-sm leading-6 text-stone-600">
              {t("chooseMethodDescription")}
            </p>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <PaymentMethodCard
                method="TELEBIRR"
                name="Telebirr"
                selected={method === "TELEBIRR"}
                available={paymentConfiguration.telebirr.available}
                unavailableLabel={t("unavailable")}
                onSelect={setMethod}
              />
              <PaymentMethodCard
                method="CBE"
                name={t("cbeName")}
                selected={method === "CBE"}
                available={paymentConfiguration.cbe.available}
                unavailableLabel={t("unavailable")}
                onSelect={setMethod}
              />
            </div>

            {!hasAvailablePaymentMethod && (
              <p className="awash-alert-error mt-5" role="alert">
                {t("configurationUnavailable")}
              </p>
            )}

            {method && methodConfiguration?.available && (
              <div className="mt-5 rounded-xl border border-orange-200 bg-orange-50/50 p-4 sm:p-5">
                <h3 className="font-bold">
                  {method === "TELEBIRR"
                    ? t("telebirrInstructionsTitle")
                    : t("cbeInstructionsTitle")}
                </h3>
                <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                  {method === "TELEBIRR" ? (
                    <>
                      <SummaryItem label={t("recipientName")}>
                        {paymentConfiguration.telebirr.recipientName}
                      </SummaryItem>
                      <SummaryItem label={t("merchantNumber")}>
                        {paymentConfiguration.telebirr.merchantNumber}
                      </SummaryItem>
                    </>
                  ) : (
                    <>
                      <SummaryItem label={t("accountHolder")}>
                        {paymentConfiguration.cbe.accountHolderName}
                      </SummaryItem>
                      <SummaryItem label={t("accountNumber")}>
                        {paymentConfiguration.cbe.accountNumber}
                      </SummaryItem>
                    </>
                  )}
                  <SummaryItem label={t("exactAmount")}>
                    {formatPrice(booking.trip.price)}
                  </SummaryItem>
                </dl>
                <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-stone-700">
                  <li>
                    {method === "TELEBIRR"
                      ? t("telebirrInstructionOne")
                      : t("cbeInstructionOne")}
                  </li>
                  <li>{t("instructionExactAmount")}</li>
                  <li>{t("instructionReference")}</li>
                </ol>
              </div>
            )}

            {canSubmit && methodConfiguration?.available && (
              <form onSubmit={handleSubmit} className="mt-6">
                <h3 className="font-bold">{t("submitDetailsTitle")}</h3>
                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="awash-label sm:col-span-2">
                    {t("transactionReference")}
                    <input
                      required
                      minLength={4}
                      maxLength={100}
                      value={transactionReference}
                      onChange={(event) =>
                        setTransactionReference(event.target.value)
                      }
                      className="awash-input"
                      autoComplete="off"
                    />
                  </label>
                  <label className="awash-label">
                    {t("senderName")}
                    <input
                      required
                      minLength={2}
                      maxLength={120}
                      value={senderName}
                      onChange={(event) => setSenderName(event.target.value)}
                      className="awash-input"
                      autoComplete="name"
                    />
                  </label>
                  <label className="awash-label">
                    {method === "TELEBIRR"
                      ? t("senderPhone")
                      : t("senderAccount")}
                    <input
                      required
                      minLength={3}
                      maxLength={100}
                      value={senderIdentifier}
                      onChange={(event) =>
                        setSenderIdentifier(event.target.value)
                      }
                      className="awash-input"
                      autoComplete="off"
                    />
                  </label>
                </div>
                <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-6 text-amber-950">
                  {t("verificationNotice")}
                </p>
                {submitError && (
                  <p className="awash-alert-error mt-4" role="alert">
                    {submitError}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={
                    submitting ||
                    !transactionReference.trim() ||
                    !senderName.trim() ||
                    !senderIdentifier.trim()
                  }
                  className="awash-primary mt-5 w-full"
                >
                  {submitting ? t("submitting") : t("submitForVerification")}
                </button>
              </form>
            )}
          </section>
        </div>

        {booking.payments.length > 0 && (
          <section className="awash-card mt-6 p-5 sm:p-6">
            <h2 className="text-xl font-bold">{t("paymentHistory")}</h2>
            <ul className="mt-4 divide-y divide-stone-200">
              {booking.payments.map((payment) => (
                <li
                  key={payment.id}
                  className="grid gap-3 py-4 sm:grid-cols-[1fr_auto] sm:items-center"
                >
                  <div>
                    <p className="font-semibold">
                      {payment.method === "TELEBIRR"
                        ? "Telebirr"
                        : t("cbeName")}
                    </p>
                    <p className="mt-1 break-all font-mono text-xs text-stone-500">
                      {payment.transactionReference}
                    </p>
                    <p className="mt-1 text-xs text-stone-500">
                      {formatDateTime(payment.createdAt)}
                    </p>
                    {payment.rejectionReason && (
                      <p className="mt-2 text-sm text-red-700">
                        {payment.rejectionReason}
                      </p>
                    )}
                  </div>
                  <PaymentStatusBadge
                    label={tPaymentStatus(payment.status)}
                    status={payment.status}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </main>
    </div>
  );
}

function CheckoutHeader() {
  const t = useTranslations("checkout");
  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
      <div className="awash-container flex min-h-18 items-center justify-between gap-4">
        <Link
          href="/passenger/dashboard"
          className="text-sm font-extrabold tracking-tight text-stone-950 sm:text-base"
        >
          AWASH BUS
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher compact />
          <Link
            href="/passenger/dashboard"
            className="awash-secondary min-h-10 px-3 sm:px-4"
          >
            {t("backToBookings")}
          </Link>
        </div>
      </div>
    </header>
  );
}

function SummaryItem({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-stone-900">
        {children}
      </dd>
    </div>
  );
}

function PaymentMethodCard({
  method,
  name,
  selected,
  available,
  unavailableLabel,
  onSelect,
}: {
  method: PaymentMethod;
  name: string;
  selected: boolean;
  available: boolean;
  unavailableLabel: string;
  onSelect: (method: PaymentMethod) => void;
}) {
  return (
    <button
      type="button"
      disabled={!available}
      aria-pressed={selected}
      onClick={() => onSelect(method)}
      className={`flex min-h-36 flex-col items-center justify-center rounded-xl border-2 bg-white p-5 text-center transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        selected
          ? "border-awash-orange shadow-sm"
          : "border-stone-200 hover:border-orange-300"
      }`}
    >
      {method === "TELEBIRR" ? (
        <Image
          src="/images/payments/telebirr.png"
          alt="Telebirr"
          width={174}
          height={80}
          className="h-16 w-auto object-contain"
        />
      ) : (
        <Image
          src="/images/payments/cbe-logo.jpg"
          alt="Commercial Bank of Ethiopia"
          width={151}
          height={148}
          className="h-16 w-auto object-contain"
        />
      )}
      <span className="mt-3 text-sm font-bold text-stone-900">{name}</span>
      {!available && (
        <span className="mt-1 text-xs font-medium text-red-700">
          {unavailableLabel}
        </span>
      )}
    </button>
  );
}

function PaymentStatusBadge({
  label,
  status,
}: {
  label: string;
  status: PaymentStatus | "AWAITING_PAYMENT";
}) {
  const style =
    status === "VERIFIED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "REJECTED" || status === "EXPIRED"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "REFUNDED"
          ? "border-violet-200 bg-violet-50 text-violet-800"
          : status === "PENDING"
            ? "border-blue-200 bg-blue-50 text-blue-800"
            : "border-amber-200 bg-amber-50 text-amber-900";
  return (
    <span
      className={`inline-flex w-fit rounded-full border px-3 py-1 text-xs font-bold ${style}`}
    >
      {label}
    </span>
  );
}
