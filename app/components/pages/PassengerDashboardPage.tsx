"use client";

import Image from "next/image";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { signOut, useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import SessionWarningModal from "@/app/components/SessionWarningModal";
import {
  servedCityLabel,
  useServedRoutes,
} from "@/app/hooks/useServedRoutes";
import { useIdleTimer } from "@/app/hooks/useIdleTimer";
import { Link, useRouter } from "@/i18n/navigation";
import { readApiErrorCode } from "@/lib/api-client";
import { cityLabel, stableCityValue } from "@/lib/ethiopian-cities";

const WARNING_TIMEOUT = 120_000;
const LOGOUT_TIMEOUT = 180_000;
const INITIAL_VISIBLE_TRIPS = 6;
const FEW_SEATS_THRESHOLD = 5;

interface Route {
  id: string;
  origin: string;
  destination: string;
  originEn?: string | null;
  originAm?: string | null;
  destinationEn?: string | null;
  destinationAm?: string | null;
}

interface Bus {
  id: string;
  plateNumber: string;
  totalSeats: number;
}

type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED" | "ARCHIVED";
type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
type PaymentMethod = "TELEBIRR" | "CBE";
type PaymentStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "REFUNDED";

interface Trip {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  status: TripStatus;
  route: Route;
  bus: Bus;
  _count: { bookings: number };
}

interface TripsResponse {
  trips: Trip[];
  totalUpcoming: number;
}

interface TripFilters {
  origin: string;
  destination: string;
  date: string;
}

interface BookingRecord {
  id: string;
  seatNumber: number;
  fullName: string;
  phone: string;
  email: string | null;
  status: BookingStatus;
  holdExpiresAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  payments: Array<{
    id: string;
    method: PaymentMethod;
    amount: string;
    currency: string;
    transactionReference: string;
    status: PaymentStatus;
    rejectionReason: string | null;
    verifiedAt: string | null;
    createdAt: string;
  }>;
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
      originEn?: string | null;
      originAm?: string | null;
      destinationEn?: string | null;
      destinationAm?: string | null;
    };
    bus: {
      plateNumber: string;
    };
  };
}

type Tab = "search" | "bookings";

function StatusBadge({ status }: { status: BookingStatus | TripStatus }) {
  const t = useTranslations("status");
  const styles =
    status === "CONFIRMED" || status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "PENDING" || status === "SCHEDULED"
        ? "border-blue-200 bg-blue-50 text-blue-800"
        : "border-red-200 bg-red-50 text-red-800";

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {t(status)}
    </span>
  );
}

function PassengerPaymentBadge({ booking }: { booking: BookingRecord }) {
  const t = useTranslations("paymentStatus");
  const latestPayment = booking.payments[0];
  const status =
    booking.status === "EXPIRED"
      ? "EXPIRED"
      : booking.status === "CONFIRMED"
        ? "VERIFIED"
        : latestPayment?.status ?? "AWAITING_PAYMENT";
  const styles =
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
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {t(status)}
    </span>
  );
}

function TripCard({
  trip,
  localizedCity,
  formatDate,
  formatTime,
  formatPrice,
  formatNumber,
}: {
  trip: Trip;
  localizedCity: (
    value: string,
    en?: string | null,
    am?: string | null,
  ) => string;
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
  formatPrice: (value: string) => string;
  formatNumber: (value: number) => string;
}) {
  const t = useTranslations("passenger");
  const tCommon = useTranslations("common");
  const availableSeats = Math.max(
    0,
    trip.bus.totalSeats - trip._count.bookings,
  );
  const soldOut = availableSeats === 0;
  const fewSeats = availableSeats > 0 && availableSeats <= FEW_SEATS_THRESHOLD;
  const seatStatusStyles = soldOut
    ? "border-red-200 bg-red-50 text-red-800"
    : fewSeats
      ? "border-amber-200 bg-amber-50 text-amber-800"
      : "border-emerald-200 bg-emerald-50 text-emerald-800";

  return (
    <li className="awash-card overflow-hidden">
      <article className="grid gap-0 lg:grid-cols-[1fr_auto]">
        <div className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-stone-900 sm:text-xl">
                {localizedCity(
                  trip.route.origin,
                  trip.route.originEn,
                  trip.route.originAm,
                )}
                <span aria-hidden="true" className="mx-2 text-awash-orange">
                  →
                </span>
                {localizedCity(
                  trip.route.destination,
                  trip.route.destinationEn,
                  trip.route.destinationAm,
                )}
              </h3>
              <p className="mt-1 text-sm text-stone-500">
                {t("busPlate")}:{" "}
                <span className="font-semibold text-stone-700">
                  {trip.bus.plateNumber}
                </span>
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="sr-only">{t("tripStatus")}:</span>
              <StatusBadge status={trip.status} />
              {soldOut && (
                <span className="inline-flex rounded-md border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800">
                  {t("soldOut")}
                </span>
              )}
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-x-5 gap-y-4 border-t border-stone-200 pt-5 sm:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold text-stone-500">
                {t("tripDate")}
              </dt>
              <dd className="mt-1 text-sm font-semibold text-stone-900">
                {formatDate(trip.date)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-stone-500">
                {tCommon("departure")}
              </dt>
              <dd className="mt-1 text-base font-bold text-stone-900">
                {formatTime(trip.departureTime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-stone-500">
                {tCommon("arrival")}
              </dt>
              <dd className="mt-1 text-base font-bold text-stone-900">
                {formatTime(trip.arrivalTime)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-stone-500">
                {t("availableSeats")}
              </dt>
              <dd
                className={`mt-1 inline-flex min-h-8 items-center gap-2 rounded-lg border px-3 py-1.5 text-sm font-semibold ${seatStatusStyles}`}
              >
                {soldOut ? (
                  t("soldOut")
                ) : (
                  <>
                    <span>{formatNumber(availableSeats)}</span>
                    <span>{t("seatsLeft")}</span>
                  </>
                )}
              </dd>
            </div>
          </dl>
        </div>

        <div className="flex items-center justify-between gap-4 border-t border-stone-200 bg-stone-50 px-5 py-4 lg:min-w-52 lg:flex-col lg:items-end lg:justify-center lg:border-l lg:border-t-0 lg:px-6 lg:text-right">
          <div>
            <p className="text-xs font-semibold text-stone-500">
              {tCommon("price")}
            </p>
            <p className="mt-1 text-xl font-bold text-awash-orange">
              {formatPrice(trip.price)}
            </p>
          </div>

          {soldOut ? (
            <button
              type="button"
              disabled
              aria-disabled="true"
              className="awash-primary"
            >
              {t("bookNow")}
            </button>
          ) : (
            <Link
              href={`/passenger/booking/${trip.id}`}
              className="awash-primary"
            >
              {t("bookNow")}
            </Link>
          )}
        </div>
      </article>
    </li>
  );
}

function TripsLoadingSkeleton() {
  const t = useTranslations("passenger");

  return (
    <div aria-busy="true" aria-label={t("loadingDepartures")} role="status">
      <span className="sr-only">{t("loadingDepartures")}</span>
      <ul className="grid gap-4">
        {Array.from({ length: 3 }, (_, index) => (
          <li
            key={index}
            className="awash-card animate-pulse p-5 motion-reduce:animate-none sm:p-6"
          >
            <div className="h-6 w-2/3 rounded bg-stone-200" />
            <div className="mt-3 h-4 w-32 rounded bg-stone-200" />
            <div className="mt-6 grid grid-cols-2 gap-4 border-t border-stone-200 pt-5 sm:grid-cols-4">
              {Array.from({ length: 4 }, (_, itemIndex) => (
                <div key={itemIndex}>
                  <div className="h-3 w-16 rounded bg-stone-200" />
                  <div className="mt-2 h-5 w-24 rounded bg-stone-200" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function PassengerDashboardPage() {
  const t = useTranslations("passenger");

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-600">
          {t("loadingDashboard")}
        </div>
      }
    >
      <PassengerDashboardContent />
    </Suspense>
  );
}

function PassengerDashboardContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const format = useFormatter();
  const t = useTranslations("passenger");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const {
    origins: servedOrigins,
    destinationsFor,
    loading: servedRoutesLoading,
  } = useServedRoutes();
  const [activeTab, setActiveTab] = useState<Tab>("search");
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(0);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [totalUpcoming, setTotalUpcoming] = useState(0);
  const [visibleTripCount, setVisibleTripCount] = useState(
    INITIAL_VISIBLE_TRIPS,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const currentFiltersRef = useRef<TripFilters>({
    origin: "",
    destination: "",
    date: "",
  });
  const requestIdRef = useRef(0);

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
  const servedDestinations = useMemo(
    () => destinationsFor(origin),
    [destinationsFor, origin],
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
    (value: string) =>
      format.number(Number(value), {
        style: "currency",
        currency: "ETB",
        maximumFractionDigits: 2,
      }),
    [format],
  );

  const formatNumber = useCallback(
    (value: number) => format.number(value),
    [format],
  );

  const handleSessionLogout = useCallback(async () => {
    await signOut({ redirect: false });
    router.push("/");
    router.refresh();
  }, [router]);

  const { resetTimer, logoutNow } = useIdleTimer({
    warningTimeout: WARNING_TIMEOUT,
    logoutTimeout: LOGOUT_TIMEOUT,
    onWarning: (expiresAt) => {
      setSessionExpiresAt(expiresAt);
      setShowSessionWarning(true);
    },
    onLogout: () => void handleSessionLogout(),
  });

  const fetchTrips = useCallback(
    async (
      filters: TripFilters,
      options?: { showLoading?: boolean; resetVisible?: boolean },
    ) => {
      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;
      const showLoading = options?.showLoading ?? true;
      const resetVisible = options?.resetVisible ?? true;

      if (showLoading) setLoading(true);
      setError(null);

      try {
        const params = new URLSearchParams();
        if (filters.origin) {
          params.set("origin", stableCityValue(filters.origin));
        }
        if (filters.destination) {
          params.set("destination", stableCityValue(filters.destination));
        }
        if (filters.date) params.set("date", filters.date);

        const query = params.toString();
        const response = await fetch(
          `/api/passenger/trips${query ? `?${query}` : ""}`,
          {
            cache: "no-store",
            headers: {
              Accept: "application/json",
              "Cache-Control": "no-cache",
            },
          },
        );

        if (!response.ok) {
          const code = await readApiErrorCode(response);
          throw new Error(translateError(code, "SEARCH_TRIPS_FAILED"));
        }

        const result = (await response.json()) as TripsResponse;
        if (requestId !== requestIdRef.current) return;

        setTrips(result.trips);
        setTotalUpcoming(result.totalUpcoming);
        if (resetVisible) setVisibleTripCount(INITIAL_VISIBLE_TRIPS);
      } catch (searchError) {
        if (requestId !== requestIdRef.current) return;

        setError(
          searchError instanceof Error
            ? searchError.message
            : translateError("SEARCH_TRIPS_FAILED", "SEARCH_TRIPS_FAILED"),
        );
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false);
        }
      }
    },
    [translateError],
  );

  useEffect(() => {
    const originParam = searchParams.get("origin");
    const destinationParam = searchParams.get("destination");
    const dateParam = searchParams.get("date");
    const requestedTab: Tab =
      searchParams.get("tab") === "bookings" ? "bookings" : "search";
    const nextFilters: TripFilters = {
      origin: originParam ? stableCityValue(originParam) : "",
      destination: destinationParam
        ? stableCityValue(destinationParam)
        : "",
      date: dateParam ?? "",
    };

    queueMicrotask(() => {
      setActiveTab(requestedTab);
      setOrigin(nextFilters.origin);
      setDestination(nextFilters.destination);
      setDate(nextFilters.date);
      currentFiltersRef.current = nextFilters;
      void fetchTrips(nextFilters);
    });
  }, [fetchTrips, searchParams]);

  useEffect(() => {
    const refreshOnFocus = () => {
      if (document.visibilityState !== "visible") return;

      void fetchTrips(currentFiltersRef.current, {
        showLoading: false,
        resetVisible: false,
      });
    };

    window.addEventListener("focus", refreshOnFocus);
    return () => window.removeEventListener("focus", refreshOnFocus);
  }, [fetchTrips]);

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);

    const nextParams = new URLSearchParams(searchParams.toString());
    if (tab === "bookings") {
      nextParams.set("tab", "bookings");
    } else {
      nextParams.delete("tab");
    }

    const query = nextParams.toString();
    router.replace(
      `/passenger/dashboard${query ? `?${query}` : ""}${window.location.hash}`,
    );
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (origin && destination && origin === destination) {
      setError(tErrors("SEARCH_SAME_CITY"));
      return;
    }

    applyFilters({ origin, destination, date });
  }

  function applyFilters(filters: TripFilters) {
    const nextParams = new URLSearchParams(searchParams.toString());

    for (const [key, value] of Object.entries(filters)) {
      if (value) nextParams.set(key, value);
      else nextParams.delete(key);
    }
    nextParams.delete("tab");

    currentFiltersRef.current = filters;
    const nextQuery = nextParams.toString();
    const currentQuery = searchParams.toString();

    if (nextQuery === currentQuery) {
      void fetchTrips(filters);
      return;
    }

    router.replace(
      `/passenger/dashboard${nextQuery ? `?${nextQuery}` : ""}${window.location.hash}`,
    );
  }

  function clearFilters() {
    const clearedFilters = { origin: "", destination: "", date: "" };
    setOrigin("");
    setDestination("");
    setDate("");
    setVisibleTripCount(INITIAL_VISIBLE_TRIPS);
    applyFilters(clearedFilters);
  }

  const hasActiveFilters = Boolean(origin || destination || date);
  const visibleTrips = trips.slice(0, visibleTripCount);
  const hasMoreTrips = visibleTripCount < trips.length;

  const tabs = useMemo(
    () =>
      [
        { key: "search" as const, label: t("searchTrips") },
        { key: "bookings" as const, label: t("myBookings") },
      ] satisfies { key: Tab; label: string }[],
    [t],
  );

  return (
    <div className="min-h-screen bg-stone-100">
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
            <div className="hidden text-right sm:block">
              <p className="text-xs text-stone-500">{t("account")}</p>
              <p className="max-w-48 truncate text-sm font-semibold text-stone-900">
                {status === "loading"
                  ? tCommon("loading")
                  : (session?.user?.fullName ?? tCommon("guest"))}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void handleSessionLogout()}
              className="awash-secondary min-h-10 px-3 sm:px-4"
            >
              {tCommon("signOut")}
            </button>
          </div>
        </div>
      </header>

      <nav className="border-b border-stone-200 bg-white">
        <div className="awash-container flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => handleTabChange(tab.key)}
              className={`border-b-2 px-4 py-3 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 ${
                activeTab === tab.key
                  ? "border-awash-orange text-awash-orange"
                  : "border-transparent text-stone-600 hover:text-stone-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      <main className="awash-container py-8 sm:py-10">
        {activeTab === "search" ? (
          <>
            <section className="relative h-[240px] overflow-hidden rounded-xl bg-stone-900 shadow-sm sm:h-[270px] lg:h-[300px]">
              <div className="absolute inset-y-0 right-0 w-full lg:w-[46%]">
                <Image
                  src="/images/awash-bus-front.jpg"
                  alt={t("dashboardImageAlt")}
                  fill
                  priority
                  sizes="(min-width: 1280px) 560px, (min-width: 1024px) 46vw, 100vw"
                  className="object-cover object-[44%_54%]"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-stone-950/95 via-stone-950/75 to-stone-950/20 lg:w-[66%] lg:to-transparent" />
              <div className="relative z-10 flex h-full max-w-xl flex-col justify-end px-6 py-7 text-white sm:px-8 sm:py-9 lg:justify-center lg:px-10">
                <p className="text-sm font-bold text-orange-200">
                  {t("dashboard")}
                </p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
                  {t("bannerTitle")}
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-stone-100 sm:text-base sm:leading-7">
                  {t("bannerDescription")}
                </p>
              </div>
            </section>

            <form
              onSubmit={handleSubmit}
              className="awash-card mt-6 p-5 sm:p-7"
            >
              <div>
                <p className="awash-section-label">{t("searchTrips")}</p>
                <h2 className="mt-1 text-2xl font-bold tracking-tight text-stone-900">
                  {t("searchTitle")}
                </h2>
                <p className="mt-2 text-sm text-stone-600">
                  {t("searchDescription")}
                </p>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_1fr_0.85fr_auto] lg:items-end">
                <label className="awash-label">
                  {t("origin")}
                  <select
                    id="origin"
                    value={origin}
                    onChange={(event) => {
                      setOrigin(event.target.value);
                      setDestination("");
                    }}
                    className="awash-input"
                  >
                    <option value="">{t("allOrigins")}</option>
                    {servedOrigins.map((city) => (
                      <option key={city.value} value={city.value}>
                        {servedCityLabel(city, locale)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="awash-label">
                  {t("destination")}
                  <select
                    id="destination"
                    value={destination}
                    onChange={(event) => setDestination(event.target.value)}
                    className="awash-input"
                    disabled={!origin || servedRoutesLoading}
                  >
                    <option value="">{t("allDestinations")}</option>
                    {servedDestinations.map((city) => (
                      <option key={city.value} value={city.value}>
                        {servedCityLabel(city, locale)}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="awash-label">
                  {t("travelDate")}
                  <input
                    id="date"
                    type="date"
                    min={new Date().toISOString().slice(0, 10)}
                    value={date}
                    onChange={(event) => setDate(event.target.value)}
                    className="awash-input"
                  />
                </label>

                <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                  <button
                    type="submit"
                    disabled={loading}
                    className="awash-primary w-full lg:min-w-40"
                  >
                    {loading ? t("searching") : t("search")}
                  </button>
                  {hasActiveFilters && (
                    <button
                      type="button"
                      onClick={clearFilters}
                      className="awash-secondary w-full lg:min-w-40"
                    >
                      {t("clearFilters")}
                    </button>
                  )}
                </div>
              </div>
            </form>

            <section className="mt-8" aria-labelledby="available-departures">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2
                    id="available-departures"
                    className="text-xl font-bold text-stone-900 sm:text-2xl"
                  >
                    {t("tripResults")}
                  </h2>
                  {!loading && !error && (
                    <p
                      aria-live="polite"
                      className="mt-1 text-sm text-stone-600"
                    >
                      {t("departuresFound", { count: trips.length })}
                    </p>
                  )}
                </div>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="text-sm font-bold text-awash-orange underline-offset-4 hover:text-awash-orange-dark hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2"
                  >
                    {t("clearFilters")}
                  </button>
                )}
              </div>

              {loading ? (
                <TripsLoadingSkeleton />
              ) : error ? (
                <div className="awash-alert-error" role="alert">
                  <p>{error}</p>
                  <button
                    type="button"
                    onClick={() => void fetchTrips(currentFiltersRef.current)}
                    className="mt-2 font-semibold underline"
                  >
                    {tCommon("retry")}
                  </button>
                </div>
              ) : totalUpcoming === 0 ? (
                <div className="awash-card px-6 py-10 text-center">
                  <h3 className="text-lg font-bold text-stone-900">
                    {t("noUpcomingTitle")}
                  </h3>
                  <p className="mt-2 text-sm text-stone-600">
                    {t("noUpcomingDescription")}
                  </p>
                </div>
              ) : trips.length === 0 ? (
                <div className="awash-card px-6 py-10 text-center">
                  <h3 className="text-lg font-bold text-stone-900">
                    {origin && destination
                      ? t("noFutureRoute")
                      : t("noFilteredTrips")}
                  </h3>
                  <p className="mt-2 text-sm text-stone-600">
                    {t("adjustFilters")}
                  </p>
                  <button
                    type="button"
                    onClick={clearFilters}
                    className="awash-secondary mt-5"
                  >
                    {t("clearFilters")}
                  </button>
                </div>
              ) : (
                <>
                  <ul id="departure-list" className="grid gap-4">
                    {visibleTrips.map((trip) => (
                      <TripCard
                        key={trip.id}
                        trip={trip}
                        localizedCity={localizedCity}
                        formatDate={formatDate}
                        formatTime={formatTime}
                        formatPrice={formatPrice}
                        formatNumber={formatNumber}
                      />
                    ))}
                  </ul>

                  {hasMoreTrips && (
                    <div className="mt-6 flex justify-center">
                      <button
                        type="button"
                        aria-controls="departure-list"
                        onClick={() =>
                          setVisibleTripCount((current) =>
                            Math.min(
                              current + INITIAL_VISIBLE_TRIPS,
                              trips.length,
                            ),
                          )
                        }
                        className="awash-secondary min-w-40"
                      >
                        {t("loadMore")}
                      </button>
                    </div>
                  )}
                </>
              )}
            </section>
          </>
        ) : (
          <MyBookingsTab
            formatDate={formatDate}
            formatTime={formatTime}
            formatPrice={formatPrice}
            localizedCity={localizedCity}
          />
        )}
      </main>

      <SessionWarningModal
        isVisible={showSessionWarning}
        expiresAt={sessionExpiresAt}
        onStayLoggedIn={() => {
          setShowSessionWarning(false);
          setSessionExpiresAt(0);
          resetTimer();
        }}
        onLogOut={logoutNow}
      />
    </div>
  );
}

function MyBookingsTab({
  formatDate,
  formatTime,
  formatPrice,
  localizedCity,
}: {
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
  formatPrice: (value: string) => string;
  localizedCity: (
    value: string,
    en?: string | null,
    am?: string | null,
  ) => string;
}) {
  const t = useTranslations("passenger");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bookingView, setBookingView] = useState<"active" | "history">(
    "active",
  );

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/passenger/bookings?view=${bookingView}`,
      );

      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code) ? tErrors(code) : tErrors("LOAD_BOOKINGS_FAILED"),
        );
      }

      setBookings((await response.json()) as BookingRecord[]);
    } catch (fetchError) {
      setError(
        fetchError instanceof Error
          ? fetchError.message
          : tErrors("LOAD_BOOKINGS_FAILED"),
      );
    } finally {
      setLoading(false);
    }
  }, [bookingView, tErrors]);

  useEffect(() => {
    queueMicrotask(() => void fetchBookings());
  }, [fetchBookings]);

  return (
    <section>
      <h1 className="text-2xl font-bold tracking-tight text-stone-900">
        {t("myBookings")}
      </h1>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t("bookingViews")}>
        <button
          type="button"
          onClick={() => setBookingView("active")}
          className={bookingView === "active" ? "awash-primary" : "awash-secondary"}
        >
          {t("activeBookings")}
        </button>
        <button
          type="button"
          onClick={() => setBookingView("history")}
          className={bookingView === "history" ? "awash-primary" : "awash-secondary"}
        >
          {t("bookingHistory")}
        </button>
      </div>

      {loading ? (
        <div className="awash-card mt-5 p-6 text-sm text-stone-600">
          {t("loadingBookings")}
        </div>
      ) : error ? (
        <div className="awash-alert-error mt-5">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void fetchBookings()}
            className="mt-2 font-semibold underline"
          >
            {tCommon("retry")}
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="awash-card mt-5 p-6 text-sm text-stone-600">
          {bookingView === "history" ? t("noBookingHistory") : t("noBookings")}
        </div>
      ) : (
        <ul className="mt-5 grid gap-4">
          {bookings.map((booking) => (
            <li key={booking.id} className="awash-card p-5 sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-bold text-stone-900">
                    {localizedCity(
                      booking.trip.route.origin,
                      booking.trip.route.originEn,
                      booking.trip.route.originAm,
                    )}
                    <span className="mx-2 text-awash-orange">→</span>
                    {localizedCity(
                      booking.trip.route.destination,
                      booking.trip.route.destinationEn,
                      booking.trip.route.destinationAm,
                    )}
                  </p>
                  <p className="mt-1 font-mono text-xs text-stone-500">
                    {t("bookingId")}: {booking.id}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <PassengerPaymentBadge booking={booking} />
                  {bookingView === "history" && (
                    <StatusBadge status={booking.status} />
                  )}
                  {booking.trip.status !== "SCHEDULED" && (
                    <StatusBadge status={booking.trip.status} />
                  )}
                </div>
              </div>

              {booking.trip.status === "CANCELLED" && (
                <p
                  role="status"
                  className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800"
                >
                  {t("cancelledTripNotice")}
                </p>
              )}
              {booking.trip.status === "COMPLETED" && (
                <p
                  role="status"
                  className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800"
                >
                  {t("completedTripNotice")}
                </p>
              )}
              {booking.payments[0]?.status === "REJECTED" &&
                booking.payments[0].rejectionReason && (
                  <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    <span className="font-bold">
                      {t("paymentRejectionReason")}:
                    </span>{" "}
                    {booking.payments[0].rejectionReason}
                  </p>
                )}

              <div className="mt-5 grid gap-4 border-t border-stone-200 pt-5 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    {tCommon("passenger")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">
                    {booking.fullName}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    {t("tripDate")}
                  </p>
                  <p className="mt-1 text-sm text-stone-900">
                    {formatDate(booking.trip.date)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    {t("tripTime")}
                  </p>
                  <p className="mt-1 text-sm text-stone-900">
                    {formatTime(booking.trip.departureTime)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    {tCommon("seat")}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-stone-900">
                    {booking.seatNumber}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-stone-500">
                    {tCommon("price")}
                  </p>
                  <p className="mt-1 text-sm font-bold text-awash-orange">
                    {formatPrice(booking.trip.price)}
                  </p>
                </div>
              </div>
              {booking.trip.status === "SCHEDULED" &&
                booking.status !== "EXPIRED" &&
                booking.status !== "CANCELLED" && (
                  <div className="mt-5 flex justify-end border-t border-stone-200 pt-4">
                    <Link
                      href={`/passenger/checkout/${booking.id}`}
                      className={
                        booking.status === "PENDING" &&
                        (!booking.payments[0] ||
                          booking.payments[0].status === "REJECTED")
                          ? "awash-primary"
                          : "awash-secondary"
                      }
                    >
                      {booking.status === "PENDING" &&
                      !booking.payments[0]
                        ? t("payNow")
                        : booking.payments[0]?.status === "REJECTED"
                          ? t("retryPayment")
                          : t("viewPayment")}
                    </Link>
                  </div>
                )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
