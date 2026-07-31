"use client";

import { use, useCallback, useEffect, useMemo, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import { Link, useRouter } from "@/i18n/navigation";
import { readApiErrorCode } from "@/lib/api-client";
import { cityLabel } from "@/lib/ethiopian-cities";

interface Route {
  id: string;
  origin: string;
  destination: string;
  originEn: string | null;
  originAm: string | null;
  destinationEn: string | null;
  destinationAm: string | null;
}

interface Bus {
  id: string;
  plateNumber: string;
  totalSeats: number;
}

type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

interface Booking {
  id: string;
  seatNumber: number;
  status: BookingStatus;
}

interface Trip {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  status: TripStatus;
  route: Route;
  bus: Bus;
  bookings: Booking[];
}

interface PassengerDetails {
  fullName: string;
  phone: string;
  email: string;
}

interface BookingHold {
  id: string;
  seatNumber: number;
  fullName: string;
  status: "PENDING";
  holdExpiresAt: string;
}

const SEATS_PER_ROW = 6;
const MAX_SEATS = 6;
const EMPTY_FORM: PassengerDetails = { fullName: "", phone: "", email: "" };

function BookingHeader() {
  const t = useTranslations("booking");
  const tCommon = useTranslations("common");

  return (
    <header className="sticky top-0 z-30 border-b border-stone-200 bg-white">
      <div className="awash-container flex min-h-18 items-center justify-between gap-4">
        <Link
          href="/passenger/dashboard"
          className="shrink-0 text-sm font-extrabold tracking-tight text-stone-900 sm:text-base"
        >
          AWASH BUS{" "}
          <span className="hidden sm:inline">
            <span className="text-stone-300">|</span>{" "}
            <span className="text-awash-orange">አዋሽ ባስ</span>
          </span>
        </Link>
        <div className="flex items-center gap-2 sm:gap-3">
          <LanguageSwitcher compact />
          <Link
            href="/passenger/dashboard"
            className="awash-secondary min-h-10 px-3 sm:px-4"
          >
            <span className="sm:hidden">{tCommon("back")}</span>
            <span className="hidden sm:inline">{t("backToSearch")}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function BookingPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);
  const t = useTranslations("booking");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const locale = useLocale();
  const format = useFormatter();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [passengers, setPassengers] = useState<Map<number, PassengerDetails>>(
    new Map(),
  );
  const [currentForm, setCurrentForm] =
    useState<PassengerDetails>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [bookingContextRestored, setBookingContextRestored] = useState(false);

  const translateError = useCallback(
    (code: string, fallback: string) =>
      tErrors.has(code) ? tErrors(code) : tErrors(fallback),
    [tErrors],
  );

  const localizedCity = useCallback(
    (value: string, en?: string | null, am?: string | null) =>
      cityLabel(value, locale, { en, am }),
    [locale],
  );

  const formatDate = useCallback(
    (value: string) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? value
        : format.dateTime(parsed, {
            year: "numeric",
            month: "short",
            day: "numeric",
            timeZone: "UTC",
          });
    },
    [format],
  );

  const formatTime = useCallback(
    (value: string) => {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime())
        ? value
        : format.dateTime(parsed, {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "UTC",
          });
    },
    [format],
  );

  const formatPrice = useCallback(
    (value: number | string) =>
      format.number(Number(value), {
        style: "currency",
        currency: "ETB",
        maximumFractionDigits: 2,
      }),
    [format],
  );

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/trips/${tripId}`);

      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(translateError(code, "TRIP_NOT_FOUND"));
      }

      setTrip((await response.json()) as Trip);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : tErrors("TRIP_NOT_FOUND"),
      );
    } finally {
      setLoading(false);
    }
  }, [tErrors, translateError, tripId]);

  useEffect(() => {
    queueMicrotask(() => void fetchTrip());
  }, [fetchTrip]);

  useEffect(() => {
    queueMicrotask(() => {
      const storageKey = `awash_booking_${tripId}`;
      const saved = sessionStorage.getItem(storageKey);

      if (saved) {
        try {
          const parsed: unknown = JSON.parse(saved);

          if (parsed && typeof parsed === "object") {
            const context = parsed as {
              selectedSeat?: unknown;
              currentForm?: unknown;
              passengers?: unknown;
            };

            if (
              context.selectedSeat === null ||
              typeof context.selectedSeat === "number"
            ) {
              setSelectedSeat(context.selectedSeat);
            }

            if (
              context.currentForm &&
              typeof context.currentForm === "object" &&
              "fullName" in context.currentForm &&
              "phone" in context.currentForm &&
              "email" in context.currentForm
            ) {
              const form = context.currentForm as Record<string, unknown>;
              if (
                typeof form.fullName === "string" &&
                typeof form.phone === "string" &&
                typeof form.email === "string"
              ) {
                setCurrentForm({
                  fullName: form.fullName,
                  phone: form.phone,
                  email: form.email,
                });
              }
            }

            if (Array.isArray(context.passengers)) {
              const restored = new Map<number, PassengerDetails>();
              for (const entry of context.passengers) {
                if (
                  Array.isArray(entry) &&
                  typeof entry[0] === "number" &&
                  entry[1] &&
                  typeof entry[1] === "object" &&
                  typeof entry[1].fullName === "string" &&
                  typeof entry[1].phone === "string" &&
                  typeof entry[1].email === "string"
                ) {
                  restored.set(entry[0], {
                    fullName: entry[1].fullName,
                    phone: entry[1].phone,
                    email: entry[1].email,
                  });
                }
              }
              setPassengers(restored);
            }
          }
        } catch {
          sessionStorage.removeItem(storageKey);
        }
      }

      setBookingContextRestored(true);
    });
  }, [tripId]);

  useEffect(() => {
    if (!bookingContextRestored) return;

    sessionStorage.setItem(
      `awash_booking_${tripId}`,
      JSON.stringify({
        selectedSeat,
        currentForm,
        passengers: Array.from(passengers.entries()),
      }),
    );
  }, [
    bookingContextRestored,
    currentForm,
    passengers,
    selectedSeat,
    tripId,
  ]);

  function handleSeatClick(seat: number) {
    setFormError(null);

    if (passengers.has(seat)) {
      setPassengers((current) => {
        const next = new Map(current);
        next.delete(seat);
        return next;
      });
      if (selectedSeat === seat) {
        setSelectedSeat(null);
        setCurrentForm(EMPTY_FORM);
      }
      return;
    }

    if (passengers.size >= MAX_SEATS) {
      setFormError(t("maxSeats", { count: MAX_SEATS }));
      return;
    }

    setSelectedSeat(seat);
    setCurrentForm(EMPTY_FORM);
  }

  function handleAddPassenger() {
    setFormError(null);

    if (selectedSeat === null) {
      setFormError(t("selectSeatError"));
      return;
    }

    if (!currentForm.fullName.trim() || !currentForm.phone.trim()) {
      setFormError(t("passengerRequired"));
      return;
    }

    setPassengers((current) => {
      const next = new Map(current);
      next.set(selectedSeat, {
        fullName: currentForm.fullName.trim(),
        phone: currentForm.phone.trim(),
        email: currentForm.email.trim(),
      });
      return next;
    });
    setSelectedSeat(null);
    setCurrentForm(EMPTY_FORM);
  }

  async function handleContinueToCheckout() {
    setFormError(null);
    if (passengers.size === 0) return;
    setSubmitting(true);

    try {
      const response = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tripId,
          passengers: Array.from(passengers.entries()).map(
            ([seatNumber, details]) => ({
              seatNumber,
              fullName: details.fullName,
              phone: details.phone,
              email: details.email || undefined,
            }),
          ),
        }),
      });

      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(translateError(code, "CREATE_BOOKINGS_FAILED"));
      }

      const holds = (await response.json()) as BookingHold[];
      if (!holds[0]?.id) {
        throw new Error(tErrors("CREATE_BOOKINGS_FAILED"));
      }
      sessionStorage.removeItem(`awash_booking_${tripId}`);
      router.push(`/passenger/checkout/${holds[0].id}`);
    } catch (submitError) {
      setFormError(
        submitError instanceof Error
          ? submitError.message
          : tErrors("CREATE_BOOKINGS_FAILED"),
      );
      await fetchTrip();
    } finally {
      setSubmitting(false);
    }
  }

  const passengerList = useMemo(
    () =>
      Array.from(passengers.entries()).sort(([seatA], [seatB]) => seatA - seatB),
    [passengers],
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-100">
        <BookingHeader />
        <div className="flex min-h-[60vh] items-center justify-center px-4 text-stone-600">
          {t("loadingTrip")}
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-stone-100">
        <BookingHeader />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="awash-alert-error w-full max-w-md p-6 text-center">
            <p>{error ?? t("tripNotFound")}</p>
            <button
              type="button"
              onClick={() => void fetchTrip()}
              className="mt-3 font-semibold underline"
            >
              {tCommon("retry")}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (trip.status !== "SCHEDULED") {
    return (
      <div className="min-h-screen bg-stone-100">
        <BookingHeader />
        <main className="awash-container py-10">
          <section className="mx-auto max-w-xl rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm sm:p-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-xl font-bold text-red-700">
              !
            </div>
            <h1 className="mt-5 text-2xl font-bold text-stone-900">
              {t("tripUnavailableTitle")}
            </h1>
            <p className="mt-2 leading-7 text-stone-600">
              {t("tripUnavailableDescription")}
            </p>
            <Link
              href="/passenger/dashboard"
              className="awash-primary mt-6 w-full"
            >
              {t("backToSearch")}
            </Link>
          </section>
        </main>
      </div>
    );
  }

  const bookedSeats = new Set(trip.bookings.map((booking) => booking.seatNumber));
  const seats = Array.from({ length: trip.bus.totalSeats }, (_, index) => index + 1);

  return (
    <div className="min-h-screen bg-stone-100">
      <BookingHeader />
      <main className="awash-container py-8 sm:py-10">
        <div className="mb-7">
          <p className="awash-section-label">{t("tripSummary")}</p>
          <h1 className="mt-2 text-2xl font-bold tracking-tight text-stone-900 sm:text-3xl">
            {localizedCity(trip.route.origin, trip.route.originEn, trip.route.originAm)}
            <span className="mx-2 text-awash-orange">→</span>
            {localizedCity(trip.route.destination, trip.route.destinationEn, trip.route.destinationAm)}
          </h1>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-stone-600">
            <span>{formatDate(trip.date)}</span>
            <span>{formatTime(trip.departureTime)}</span>
            <span>{trip.bus.plateNumber}</span>
          </p>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
          <div className="space-y-6">
            <section className="awash-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-stone-900">
                    {t("selectSeats")}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">
                    {t("selectSeatsDescription", { count: MAX_SEATS })}
                  </p>
                </div>
                <span className="rounded-md bg-stone-100 px-3 py-1 text-sm font-semibold text-stone-700">
                  {t("selectedCount", {
                    selected: passengers.size,
                    maximum: MAX_SEATS,
                  })}
                </span>
              </div>

              <div className="mx-auto mt-7 max-w-xl rounded-xl border border-stone-200 bg-stone-50 p-3 sm:p-5">
                <div className="mb-5 h-2 rounded-full bg-stone-300" aria-hidden="true" />
                <div
                  className="grid gap-2 sm:gap-3"
                  style={{
                    gridTemplateColumns: `repeat(${SEATS_PER_ROW}, minmax(0, 1fr))`,
                  }}
                >
                  {seats.map((seat) => {
                    const isBooked = bookedSeats.has(seat);
                    const isAdded = passengers.has(seat);
                    const isActive = selectedSeat === seat;
                    const state = isBooked
                      ? "booked"
                      : isAdded
                        ? "selected"
                        : isActive
                          ? "active"
                          : "available";
                    const stateLabel = t(state);
                    const passenger = passengers.get(seat);

                    return (
                      <button
                        key={seat}
                        type="button"
                        disabled={isBooked}
                        onClick={() => handleSeatClick(seat)}
                        aria-label={t("seatAria", {
                          seat,
                          status: stateLabel,
                        })}
                        title={passenger?.fullName ?? stateLabel}
                        className={`relative flex min-h-13 flex-col items-center justify-center rounded-lg border px-1 py-2 text-sm font-bold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 ${
                          seat % SEATS_PER_ROW === 4 ? "ml-2 sm:ml-3" : ""
                        } ${
                          isBooked
                            ? "cursor-not-allowed border-stone-300 bg-stone-200 text-stone-500"
                            : isAdded
                              ? "border-awash-orange bg-awash-orange text-white"
                              : isActive
                                ? "border-awash-orange bg-orange-100 text-awash-orange-dark ring-2 ring-orange-200"
                                : "border-stone-300 bg-white text-stone-800 hover:border-emerald-500 hover:bg-emerald-50"
                        }`}
                      >
                        <span>{seat}</span>
                        <span className="mt-0.5 text-[10px]" aria-hidden="true">
                          {isBooked ? "×" : isAdded ? "✓" : isActive ? "•" : "○"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-3 text-xs text-stone-600">
                {(["available", "active", "selected", "booked"] as const).map(
                  (state) => (
                    <span key={state} className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={`flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                          state === "booked"
                            ? "border-stone-300 bg-stone-200"
                            : state === "selected"
                              ? "border-awash-orange bg-awash-orange text-white"
                              : state === "active"
                                ? "border-awash-orange bg-orange-100 text-awash-orange"
                                : "border-stone-300 bg-white"
                        }`}
                      >
                        {state === "booked"
                          ? "×"
                          : state === "selected"
                            ? "✓"
                            : state === "active"
                              ? "•"
                              : "○"}
                      </span>
                      {t(state)}
                    </span>
                  ),
                )}
              </div>
            </section>

            {selectedSeat !== null && (
              <section className="awash-card p-5 sm:p-6">
                <h2 className="text-xl font-bold text-stone-900">
                  {t("passengerForSeat", { seat: selectedSeat })}
                </h2>
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="awash-label sm:col-span-2">
                    {tCommon("fullName")}
                    <input
                      id="full-name"
                      type="text"
                      required
                      value={currentForm.fullName}
                      onChange={(event) =>
                        setCurrentForm((current) => ({
                          ...current,
                          fullName: event.target.value,
                        }))
                      }
                      className="awash-input"
                    />
                  </label>
                  <label className="awash-label">
                    {t("phoneNumber")}
                    <input
                      id="phone"
                      type="tel"
                      required
                      value={currentForm.phone}
                      onChange={(event) =>
                        setCurrentForm((current) => ({
                          ...current,
                          phone: event.target.value,
                        }))
                      }
                      className="awash-input"
                    />
                  </label>
                  <label className="awash-label">
                    {tCommon("email")}{" "}
                    <span className="font-normal text-stone-500">
                      ({tCommon("optional")})
                    </span>
                    <input
                      id="email"
                      type="email"
                      value={currentForm.email}
                      onChange={(event) =>
                        setCurrentForm((current) => ({
                          ...current,
                          email: event.target.value,
                        }))
                      }
                      className="awash-input"
                    />
                  </label>
                </div>

                {formError && (
                  <p className="awash-alert-error mt-5" role="alert">
                    {formError}
                  </p>
                )}

                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    onClick={handleAddPassenger}
                    className="awash-primary"
                  >
                    {t("addPassenger")}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedSeat(null);
                      setCurrentForm(EMPTY_FORM);
                      setFormError(null);
                    }}
                    className="awash-secondary"
                  >
                    {tCommon("cancel")}
                  </button>
                </div>
              </section>
            )}
          </div>

          <aside className="awash-card p-5 sm:p-6 lg:sticky lg:top-24">
            <h2 className="text-xl font-bold text-stone-900">{t("summary")}</h2>
            <p className="mt-1 text-sm text-stone-600">
              {t("summaryDescription")}
            </p>

            <dl className="mt-5 space-y-3 rounded-xl bg-stone-50 p-4 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{tCommon("route")}</dt>
                <dd className="text-right font-semibold text-stone-900">
                  {localizedCity(trip.route.origin, trip.route.originEn, trip.route.originAm)} →{" "}
                  {localizedCity(trip.route.destination, trip.route.destinationEn, trip.route.destinationAm)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{tCommon("date")}</dt>
                <dd className="font-semibold text-stone-900">
                  {formatDate(trip.date)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-stone-500">{t("busPlate")}</dt>
                <dd className="font-semibold text-stone-900">
                  {trip.bus.plateNumber}
                </dd>
              </div>
            </dl>

            {passengerList.length === 0 ? (
              <p className="mt-5 rounded-lg border border-dashed border-stone-300 p-4 text-sm text-stone-600">
                {t("noPassengers")}
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-stone-200">
                {passengerList.map(([seat, details]) => (
                  <li
                    key={seat}
                    className="flex items-center justify-between gap-4 py-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-50 text-xs font-bold text-awash-orange-dark">
                        {seat}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-stone-900">
                          {details.fullName}
                        </p>
                        <p className="truncate text-xs text-stone-500">
                          {details.phone}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSeatClick(seat)}
                      className="text-xs font-semibold text-red-700 hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange"
                    >
                      {t("remove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-stone-200 pt-5">
              <span className="font-semibold text-stone-700">
                {t("totalPrice")}
              </span>
              <span className="text-xl font-bold text-awash-orange">
                {formatPrice(Number(trip.price) * passengerList.length)}
              </span>
            </div>

            {formError && selectedSeat === null && (
              <p className="awash-alert-error mt-5" role="alert">
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleContinueToCheckout()}
              disabled={submitting || passengers.size === 0}
              className="awash-primary mt-5 w-full"
            >
              {submitting ? t("creatingHold") : t("continueToCheckout")}
            </button>
          </aside>
        </div>
      </main>
    </div>
  );
}
