"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from "react";
import { signOut, useSession } from "next-auth/react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import CityCombobox from "@/app/components/operator/CityCombobox";
import OperatorBookingsTab from "@/app/components/operator/OperatorBookingsTab";
import OperatorPaymentsTab from "@/app/components/operator/OperatorPaymentsTab";
import OperatorPaymentSettingsTab from "@/app/components/operator/OperatorPaymentSettingsTab";
import OperatorDialog from "@/app/components/operator/OperatorDialog";
import {
  IconActionButton,
  InlineDetail,
  OperatorToast,
  type ToastMessage,
} from "@/app/components/operator/OperatorFeedback";
import LanguageSwitcher from "@/app/components/LanguageSwitcher";
import SessionWarningModal from "@/app/components/SessionWarningModal";
import { useIdleTimer } from "@/app/hooks/useIdleTimer";
import { Link, useRouter } from "@/i18n/navigation";
import { readApiErrorCode } from "@/lib/api-client";
import {
  ETHIOPIAN_CITIES,
  OTHER_CITY_VALUE,
  cityLabel,
  normalizeCityValue,
} from "@/lib/ethiopian-cities";

const WARNING_TIMEOUT = 120_000;
const LOGOUT_TIMEOUT = 180_000;

type Tab =
  | "overview"
  | "routes"
  | "buses"
  | "trips"
  | "bookings"
  | "payments"
  | "paymentSettings"
  | "messages";
type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED" | "ARCHIVED";
type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";
type MessageStatus = "NEW" | "READ" | "RESOLVED";

interface RouteRecord {
  id: string;
  origin: string;
  destination: string;
  originKey: string;
  destinationKey: string;
  originEn: string | null;
  originAm: string | null;
  destinationEn: string | null;
  destinationAm: string | null;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  _count: { trips: number };
}

interface Bus {
  id: string;
  plateNumber: string;
  totalSeats: number;
  isActive: boolean;
  archivedAt: string | null;
  createdAt: string;
  _count: { trips: number };
  upcomingTrips: Array<{
    id: string;
    date: string;
    departureTime: string;
    route: Pick<
      RouteRecord,
      | "origin"
      | "destination"
      | "originEn"
      | "originAm"
      | "destinationEn"
      | "destinationAm"
    >;
  }>;
}

interface Trip {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  status: TripStatus;
  route: RouteRecord;
  bus: Bus;
  _count: { bookings: number };
  lifecycle: {
    canDelete: boolean;
    bookingCount: number;
    deletableExpiredBookingCount: number;
    paymentCount: number;
    verifiedPaymentCount: number;
    refundRequiredCount: number;
    recommendedAction: "delete" | "cancel" | "archive" | "viewHistory";
  };
}

interface OverviewCounts {
  totalRoutes: number;
  totalBuses: number;
  upcomingTrips: number;
  confirmedBookings: number;
  unreadMessages: number;
  pendingPayments: number;
}

interface ContactMessage {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  subject: string | null;
  message: string;
  status: MessageStatus;
  createdAt: string;
  updatedAt: string;
  readAt: string | null;
  resolvedAt: string | null;
}

function routeLabel(route: RouteRecord, locale: string) {
  return `${cityLabel(route.origin, locale, {
    en: route.originEn,
    am: route.originAm,
  })} → ${cityLabel(route.destination, locale, {
    en: route.destinationEn,
    am: route.destinationAm,
  })}`;
}

function SectionHeading({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-stone-200 pb-5">
      <h2 className="text-xl font-bold text-stone-900">{title}</h2>
      <p className="mt-1 text-sm leading-6 text-stone-600">{description}</p>
    </div>
  );
}

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const t = useTranslations("common");
  return (
    <div className="awash-alert-error">
      <p>{message}</p>
      <button type="button" onClick={onRetry} className="mt-2 font-semibold underline">
        {t("retry")}
      </button>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: TripStatus | BookingStatus | MessageStatus;
}) {
  const tStatus = useTranslations("status");
  const styles =
    status === "COMPLETED" ||
    status === "CONFIRMED" ||
    status === "RESOLVED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "CANCELLED"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "NEW"
          ? "border-orange-200 bg-orange-50 text-orange-800"
          : status === "READ"
            ? "border-stone-200 bg-stone-100 text-stone-700"
            : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${styles}`}>
      {tStatus(status)}
    </span>
  );
}

export default function OperatorDashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const t = useTranslations("operator");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [counts, setCounts] = useState<OverviewCounts | null>(null);
  const [overviewError, setOverviewError] = useState<string | null>(null);
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionExpiresAt, setSessionExpiresAt] = useState(0);

  useEffect(() => {
    const requestedTab = new URLSearchParams(window.location.search).get("tab");
    if (
      requestedTab === "routes" ||
      requestedTab === "buses" ||
      requestedTab === "trips" ||
      requestedTab === "bookings" ||
      requestedTab === "payments" ||
      requestedTab === "paymentSettings" ||
      requestedTab === "messages"
    ) {
      queueMicrotask(() => setActiveTab(requestedTab));
    }
  }, []);

  const fetchOverview = useCallback(async () => {
    setOverviewError(null);
    try {
      const response = await fetch("/api/operator/overview");
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code) ? tErrors(code) : tErrors("LOAD_OVERVIEW_FAILED"),
        );
      }
      setCounts((await response.json()) as OverviewCounts);
    } catch (error) {
      setOverviewError(
        error instanceof Error ? error.message : tErrors("LOAD_OVERVIEW_FAILED"),
      );
    }
  }, [tErrors]);

  useEffect(() => {
    queueMicrotask(() => void fetchOverview());
  }, [fetchOverview]);

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

  const tabs = useMemo(
    () =>
      [
        { key: "overview" as const, label: t("overview") },
        { key: "routes" as const, label: t("routes") },
        { key: "buses" as const, label: t("buses") },
        { key: "trips" as const, label: t("trips") },
        { key: "bookings" as const, label: t("bookings") },
        { key: "payments" as const, label: t("payments") },
        {
          key: "paymentSettings" as const,
          label: t("paymentSettings.navigation"),
        },
        { key: "messages" as const, label: t("messages") },
      ],
    [t],
  );

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    const params = new URLSearchParams(window.location.search);
    if (tab === "overview") params.delete("tab");
    else params.set("tab", tab);
    const query = params.toString();
    router.replace(`/operator/dashboard${query ? `?${query}` : ""}`);
  }

  const navigation = (
    <>
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          onClick={() => handleTabChange(tab.key)}
          aria-current={activeTab === tab.key ? "page" : undefined}
          className={`flex min-h-11 shrink-0 items-center justify-between gap-3 rounded-lg px-3.5 py-2.5 text-left text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange ${
            activeTab === tab.key
              ? "bg-orange-50 text-awash-orange-dark"
              : "text-stone-600 hover:bg-stone-50 hover:text-stone-950"
          }`}
        >
          <span>{tab.label}</span>
          {tab.key === "messages" && (counts?.unreadMessages ?? 0) > 0 && (
            <span className="inline-flex min-w-6 justify-center rounded-full bg-awash-orange px-1.5 py-0.5 text-[11px] font-bold text-white">
              {counts?.unreadMessages}
            </span>
          )}
          {tab.key === "payments" && (counts?.pendingPayments ?? 0) > 0 && (
            <span className="inline-flex min-w-6 justify-center rounded-full bg-blue-700 px-1.5 py-0.5 text-[11px] font-bold text-white">
              {counts?.pendingPayments}
            </span>
          )}
        </button>
      ))}
    </>
  );

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="sticky top-0 z-40 border-b border-stone-200 bg-white lg:hidden">
        <div className="flex min-h-16 items-center justify-between gap-3 px-4">
          <Link href="/operator/dashboard" className="font-extrabold tracking-tight">
            AWASH <span className="text-awash-orange">BUS</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher compact />
            <button
              type="button"
              onClick={() => void handleSessionLogout()}
              className="awash-secondary min-h-9 px-3 py-1.5"
            >
              {tCommon("signOut")}
            </button>
          </div>
        </div>
        <nav
          aria-label={t("dashboardNavigation")}
          className="flex gap-1 overflow-x-auto border-t border-stone-100 px-3 py-2"
        >
          {navigation}
        </nav>
      </header>

      <div className="lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="hidden h-screen border-r border-stone-200 bg-white lg:sticky lg:top-0 lg:flex lg:flex-col">
          <div className="border-b border-stone-200 px-6 py-6">
            <Link href="/operator/dashboard" className="text-lg font-black tracking-tight">
              AWASH <span className="text-awash-orange">BUS</span>
            </Link>
            <p className="mt-1 text-xs font-semibold text-stone-500">{t("operatorConsole")}</p>
          </div>
          <nav aria-label={t("dashboardNavigation")} className="flex flex-1 flex-col gap-1 p-3">
            {navigation}
          </nav>
          <div className="border-t border-stone-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-stone-500">{tCommon("operator")}</p>
                <p className="truncate text-sm font-semibold">
                  {status === "loading"
                    ? tCommon("loading")
                    : (session?.user?.fullName ?? tCommon("guest"))}
                </p>
              </div>
              <LanguageSwitcher compact />
            </div>
            <button
              type="button"
              onClick={() => void handleSessionLogout()}
              className="awash-secondary mt-4 w-full"
            >
              {tCommon("signOut")}
            </button>
          </div>
        </aside>

        <main className="min-w-0 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 xl:px-10">
          <div className="mx-auto max-w-7xl">
            {activeTab === "overview" && (
              <OverviewTab
                counts={counts}
                error={overviewError}
                operatorName={session?.user?.fullName ?? ""}
                onRetry={() => void fetchOverview()}
                onNavigate={handleTabChange}
              />
            )}
            {activeTab === "routes" && (
              <RoutesTab onDataChanged={() => void fetchOverview()} />
            )}
            {activeTab === "buses" && (
              <BusesTab onDataChanged={() => void fetchOverview()} />
            )}
            {activeTab === "trips" && (
              <TripsTab onDataChanged={() => void fetchOverview()} />
            )}
            {activeTab === "bookings" && <OperatorBookingsTab />}
            {activeTab === "payments" && (
              <OperatorPaymentsTab
                onDataChanged={() => void fetchOverview()}
              />
            )}
            {activeTab === "paymentSettings" && (
              <OperatorPaymentSettingsTab />
            )}
            {activeTab === "messages" && (
              <MessagesTab onDataChanged={() => void fetchOverview()} />
            )}
          </div>
        </main>
      </div>

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

function OverviewTab({
  counts,
  error,
  operatorName,
  onRetry,
  onNavigate,
}: {
  counts: OverviewCounts | null;
  error: string | null;
  operatorName: string;
  onRetry: () => void;
  onNavigate: (tab: Tab) => void;
}) {
  const t = useTranslations("operator");
  const cards = [
    ["totalRoutes", counts?.totalRoutes],
    ["totalBuses", counts?.totalBuses],
    ["upcomingTrips", counts?.upcomingTrips],
    ["confirmedBookings", counts?.confirmedBookings],
    ["pendingPayments", counts?.pendingPayments],
    ["unreadMessages", counts?.unreadMessages],
  ] as const;

  return (
    <div>
      <div className="mb-6">
        <p className="awash-section-label">{t("dashboard")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("overview")}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
          {t("overviewDescription")}
        </p>
      </div>

      {error && <ErrorState message={error} onRetry={onRetry} />}

      <section aria-label={t("serviceSummary")} className="mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map(([key, value]) => (
          <div key={key} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-semibold text-stone-500">{t(key)}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-stone-950">
              {value ?? "—"}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-6 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm lg:grid lg:min-h-72 lg:grid-cols-[1fr_1.05fr]">
        <div className="flex flex-col justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 p-6 sm:p-8 lg:p-10">
          <p className="text-xs font-extrabold uppercase tracking-[0.18em] text-awash-orange">
            {t("operationsReady")}
          </p>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
            {t("greeting", { name: operatorName || t("operatorFallback") })}
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">
            {t("bannerDescription")}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <button type="button" onClick={() => onNavigate("trips")} className="awash-primary">
              {t("scheduleTrip")}
            </button>
            <button type="button" onClick={() => onNavigate("buses")} className="awash-secondary">
              {t("addBus")}
            </button>
            <button type="button" onClick={() => onNavigate("messages")} className="awash-secondary">
              {t("viewMessages")}
            </button>
          </div>
        </div>
        <div className="relative min-h-64 overflow-hidden lg:min-h-full">
          <Image
            src="/images/operator-dashboard-bus.jpg"
            alt={t("dashboardBusAlt")}
            fill
            priority
            sizes="(min-width: 1280px) 640px, (min-width: 1024px) 50vw, 100vw"
            className="object-cover object-[52%_58%]"
          />
        </div>
      </section>
    </div>
  );
}

function RoutesTab({ onDataChanged }: { onDataChanged: () => void }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("operator");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [customDestinationEn, setCustomDestinationEn] = useState("");
  const [customDestinationAm, setCustomDestinationAm] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "alphabetical">("newest");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RouteRecord | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operator/routes");
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("LOAD_ROUTES_FAILED"));
      }
      setRoutes((await response.json()) as RouteRecord[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : tErrors("LOAD_ROUTES_FAILED"));
    } finally {
      setLoading(false);
    }
  }, [tErrors]);

  useEffect(() => {
    queueMicrotask(() => void fetchRoutes());
  }, [fetchRoutes]);

  const destinationValue =
    destination === OTHER_CITY_VALUE
      ? normalizeCityValue(customDestinationEn)
      : destination;
  const formValid =
    Boolean(origin && destination) &&
    origin !== destinationValue &&
    (destination !== OTHER_CITY_VALUE ||
      Boolean(customDestinationEn.trim() && customDestinationAm.trim() && destinationValue));

  const visibleRoutes = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const filtered = query
      ? routes.filter((route) =>
          `${routeLabel(route, locale)} ${route.originEn ?? ""} ${route.originAm ?? ""} ${route.destinationEn ?? ""} ${route.destinationAm ?? ""}`
            .toLocaleLowerCase()
            .includes(query),
        )
      : [...routes];
    if (sort === "alphabetical") {
      filtered.sort((left, right) =>
        routeLabel(left, locale).localeCompare(routeLabel(right, locale), locale),
      );
    } else {
      filtered.sort(
        (left, right) =>
          new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
      );
    }
    return filtered;
  }, [locale, routes, search, sort]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setSuccess(null);
    if (!formValid) {
      setFormError(
        origin === destinationValue ? t("routeDifferent") : t("routeRequired"),
      );
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/operator/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin,
          destination,
          customDestinationEn,
          customDestinationAm,
        }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("CREATE_ROUTE_FAILED"));
      }
      const created = (await response.json()) as RouteRecord;
      setRoutes((current) => [
        created,
        ...current.filter((route) => route.id !== created.id),
      ]);
      setOrigin("");
      setDestination("");
      setCustomDestinationEn("");
      setCustomDestinationAm("");
      setSuccess(t("routeCreated"));
      onDataChanged();
    } catch (submitError) {
      setFormError(
        submitError instanceof Error ? submitError.message : tErrors("CREATE_ROUTE_FAILED"),
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRouteRemoval() {
    if (!deleteTarget) return;
    const action =
      deleteTarget._count.trips > 0 ? "archive" : "delete";
    if (!deleteTarget.isActive && action === "archive") return;

    setDeleting(true);
    try {
      const response = await fetch(
        `/api/operator/routes/${deleteTarget.id}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        outcome?: "deleted" | "archived";
      };
      if (!response.ok) {
        const code = payload.error ?? "DELETE_ROUTE_FAILED";
        setToast({
          type: "error",
          text: tErrors.has(code)
            ? tErrors(code)
            : tErrors("DELETE_ROUTE_FAILED"),
        });
        await fetchRoutes();
        return;
      }

      setDeleteTarget(null);
      setToast({
        type: "success",
        text:
          payload.outcome === "archived"
            ? t("routeArchived")
            : t("routeDeleted"),
      });
      await fetchRoutes();
      onDataChanged();
    } catch {
      setToast({
        type: "error",
        text: tErrors("DELETE_ROUTE_FAILED"),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="awash-section-label">{t("networkManagement")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("routes")}</h1>
      </div>
      <form onSubmit={handleSubmit} className="awash-card p-5 sm:p-7">
        <SectionHeading title={t("createRoute")} description={t("createRouteDescription")} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <CityCombobox
            id="route-origin"
            label={t("origin")}
            value={origin}
            locale={locale}
            options={ETHIOPIAN_CITIES}
            placeholder={t("selectOrigin")}
            searchPlaceholder={t("searchCities")}
            noResults={t("noCitiesFound")}
            onChange={setOrigin}
          />
          <CityCombobox
            id="route-destination"
            label={t("destination")}
            value={destination}
            locale={locale}
            options={ETHIOPIAN_CITIES}
            placeholder={t("selectDestination")}
            searchPlaceholder={t("searchCities")}
            noResults={t("noCitiesFound")}
            otherLabel={t("otherCity")}
            onChange={setDestination}
          />
        </div>
        {destination === OTHER_CITY_VALUE && (
          <div className="mt-4 grid gap-4 rounded-xl border border-amber-200 bg-amber-50/60 p-4 sm:grid-cols-2">
            <label className="awash-label">
              {t("customCityEnglish")}
              <input
                value={customDestinationEn}
                onChange={(event) => setCustomDestinationEn(event.target.value)}
                maxLength={80}
                className="awash-input"
              />
            </label>
            <label className="awash-label">
              {t("customCityAmharic")}
              <input
                value={customDestinationAm}
                onChange={(event) => setCustomDestinationAm(event.target.value)}
                maxLength={80}
                className="awash-input"
              />
            </label>
          </div>
        )}
        {formError && <p className="awash-alert-error mt-5" role="alert">{formError}</p>}
        {success && <p className="awash-alert-success mt-5" role="status">{success}</p>}
        <button type="submit" disabled={submitting || !formValid} className="awash-primary mt-5">
          {submitting ? t("creating") : t("createRouteButton")}
        </button>
      </form>

      <section className="awash-card overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-end sm:justify-between sm:p-6">
          <div>
            <h2 className="text-xl font-bold">{t("existingRoutes")}</h2>
            <p className="mt-1 text-sm text-stone-500">{t("routeCount", { count: visibleRoutes.length })}</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-stone-600">
              {tCommon("search")}
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("searchRoutes")}
                className="awash-input mt-1 min-h-10"
              />
            </label>
            <label className="text-xs font-semibold text-stone-600">
              {tCommon("sort")}
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value as typeof sort)}
                className="awash-input mt-1 min-h-10"
              >
                <option value="newest">{t("sortNewest")}</option>
                <option value="alphabetical">{t("sortAlphabetical")}</option>
              </select>
            </label>
          </div>
        </div>
        {loading ? (
          <p className="border-t border-stone-200 p-6 text-sm text-stone-600">{t("loadingRoutes")}</p>
        ) : error ? (
          <div className="border-t border-stone-200 p-5">
            <ErrorState message={error} onRetry={() => void fetchRoutes()} />
          </div>
        ) : visibleRoutes.length === 0 ? (
          <div className="border-t border-stone-200 px-6 py-10 text-center">
            <p className="font-semibold text-stone-800">{search ? t("noMatchingRoutes") : t("noRoutes")}</p>
            <p className="mt-1 text-sm text-stone-500">{t("emptyRoutesDescription")}</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-t border-stone-200 md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{tCommon("route")}</th>
                    <th className="px-5 py-3">{t("createdOn")}</th>
                    <th className="px-5 py-3">{tCommon("status")}</th>
                    <th className="px-5 py-3 text-right">{tCommon("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {visibleRoutes.map((route) => (
                    <tr key={route.id} className="hover:bg-stone-50/70">
                      <td className="px-5 py-4 font-semibold">{routeLabel(route, locale)}</td>
                      <td className="px-5 py-4 text-stone-600">
                        {format.dateTime(new Date(route.createdAt), { dateStyle: "medium" })}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          route.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-stone-200 bg-stone-100 text-stone-600"
                        }`}>
                          {route.isActive ? t("active") : t("archived")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <IconActionButton
                          icon="trash"
                          label={t("deleteRoute")}
                          onClick={() => setDeleteTarget(route)}
                          destructive
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-stone-200 border-t border-stone-200 md:hidden">
              {visibleRoutes.map((route) => (
                <li key={route.id} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold">{routeLabel(route, locale)}</p>
                      <p className="mt-2 text-xs text-stone-500">
                        {t("createdOn")}: {format.dateTime(new Date(route.createdAt), { dateStyle: "medium" })}
                      </p>
                      {!route.isActive && (
                        <span className="mt-2 inline-flex rounded-md border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                          {t("archived")}
                        </span>
                      )}
                    </div>
                    <IconActionButton
                      icon="trash"
                      label={t("deleteRoute")}
                      onClick={() => setDeleteTarget(route)}
                      destructive
                    />
                  </div>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <OperatorToast
        toast={toast}
        closeLabel={tCommon("close")}
        onDismiss={() => setToast(null)}
      />
      <OperatorDialog
        isOpen={Boolean(deleteTarget)}
        title={t("deleteRouteTitle", {
          route: deleteTarget ? routeLabel(deleteTarget, locale) : "",
        })}
        description={t("deleteRouteDescription")}
        closeLabel={tCommon("close")}
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button
              type="button"
              data-autofocus
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="awash-secondary"
            >
              {tCommon("cancel")}
            </button>
            {deleteTarget &&
              (deleteTarget._count.trips === 0 ||
                deleteTarget.isActive) && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleRouteRemoval()}
                  className={
                    deleteTarget._count.trips === 0
                      ? "inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-50"
                      : "awash-primary"
                  }
                >
                  {deleting
                    ? t("saving")
                    : deleteTarget._count.trips > 0
                      ? t("archiveRoute")
                      : t("deleteRoute")}
                </button>
              )}
          </>
        }
      >
        {deleteTarget && (
          <div>
            <p className="rounded-xl bg-stone-50 p-4 text-base font-bold text-stone-950">
              {routeLabel(deleteTarget, locale)}
            </p>
            {deleteTarget._count.trips > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p className="font-semibold">{t("itemInUse")}</p>
                <p className="mt-1">
                  {deleteTarget.isActive
                    ? t("routeArchiveEffect", {
                        count: deleteTarget._count.trips,
                      })
                    : t("routeAlreadyArchived")}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
                <p>{t("routeDeleteEffect")}</p>
                <p className="mt-1 font-semibold">{t("cannotUndo")}</p>
              </div>
            )}
          </div>
        )}
      </OperatorDialog>
    </div>
  );
}

function BusesTab({ onDataChanged }: { onDataChanged: () => void }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("operator");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plateNumber, setPlateNumber] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Bus | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchBuses = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/operator/buses");
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("LOAD_BUSES_FAILED"));
      }
      setBuses((await response.json()) as Bus[]);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : tErrors("LOAD_BUSES_FAILED"));
    } finally {
      setLoading(false);
    }
  }, [tErrors]);

  useEffect(() => {
    queueMicrotask(() => void fetchBuses());
  }, [fetchBuses]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const seats = Number(totalSeats);
    if (!plateNumber.trim()) {
      setFeedback({ type: "error", text: t("plateRequired") });
      return;
    }
    if (!Number.isInteger(seats) || seats < 1 || seats > 48) {
      setFeedback({ type: "error", text: t("seatRange") });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/operator/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plateNumber: plateNumber.trim(), totalSeats: seats }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("CREATE_BUS_FAILED"));
      }
      const created = (await response.json()) as Bus;
      setBuses((current) => [created, ...current.filter((bus) => bus.id !== created.id)]);
      setPlateNumber("");
      setTotalSeats("");
      setFeedback({ type: "success", text: t("busAdded") });
      onDataChanged();
    } catch (submitError) {
      setFeedback({
        type: "error",
        text: submitError instanceof Error ? submitError.message : tErrors("CREATE_BUS_FAILED"),
      });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleBusRemoval() {
    if (!deleteTarget || deleteTarget.upcomingTrips.length > 0) return;
    const action = deleteTarget._count.trips > 0 ? "archive" : "delete";
    if (!deleteTarget.isActive && action === "archive") return;

    setDeleting(true);
    try {
      const response = await fetch(`/api/operator/buses/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        outcome?: "deleted" | "archived";
      };
      if (!response.ok) {
        const code = payload.error ?? "DELETE_BUS_FAILED";
        setToast({
          type: "error",
          text: tErrors.has(code)
            ? tErrors(code)
            : tErrors("DELETE_BUS_FAILED"),
        });
        await fetchBuses();
        return;
      }

      setDeleteTarget(null);
      setToast({
        type: "success",
        text:
          payload.outcome === "archived"
            ? t("busArchived")
            : t("busDeleted"),
      });
      await fetchBuses();
      onDataChanged();
    } catch {
      setToast({
        type: "error",
        text: tErrors("DELETE_BUS_FAILED"),
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="awash-section-label">{t("fleetManagement")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("buses")}</h1>
      </div>
      <form onSubmit={handleSubmit} className="awash-card p-5 sm:p-7">
        <SectionHeading title={t("addBus")} description={t("addBusDescription")} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <label className="awash-label">
            {t("plateNumber")}
            <input value={plateNumber} onChange={(event) => setPlateNumber(event.target.value)} className="awash-input" placeholder="AA-12345" />
          </label>
          <label className="awash-label">
            {t("totalSeats")}
            <input type="number" min={1} max={48} value={totalSeats} onChange={(event) => setTotalSeats(event.target.value)} className="awash-input" placeholder="48" />
          </label>
        </div>
        {feedback && (
          <p className={`mt-5 ${feedback.type === "success" ? "awash-alert-success" : "awash-alert-error"}`} role="status">
            {feedback.text}
          </p>
        )}
        <button type="submit" disabled={submitting} className="awash-primary mt-5">
          {submitting ? t("adding") : t("addBusButton")}
        </button>
      </form>
      <section className="awash-card overflow-hidden">
        <div className="p-5 sm:p-6">
          <h2 className="text-xl font-bold">{t("existingBuses")}</h2>
        </div>
        {loading ? (
          <p className="border-t border-stone-200 p-6 text-sm text-stone-600">{t("loadingBuses")}</p>
        ) : error ? (
          <div className="border-t border-stone-200 p-5"><ErrorState message={error} onRetry={() => void fetchBuses()} /></div>
        ) : buses.length === 0 ? (
          <p className="border-t border-stone-200 p-6 text-sm text-stone-600">{t("noBuses")}</p>
        ) : (
          <>
            <div className="hidden overflow-x-auto border-t border-stone-200 sm:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{t("plateNumber")}</th>
                    <th className="px-5 py-3">{t("totalSeats")}</th>
                    <th className="px-5 py-3">{tCommon("status")}</th>
                    <th className="px-5 py-3 text-right">{tCommon("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {buses.map((bus) => (
                    <tr key={bus.id}>
                      <td className="px-5 py-4 font-semibold">{bus.plateNumber}</td>
                      <td className="px-5 py-4 text-stone-600">{t("seatCapacity", { count: bus.totalSeats })}</td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${
                          bus.isActive
                            ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                            : "border-stone-200 bg-stone-100 text-stone-600"
                        }`}>
                          {bus.isActive ? t("active") : t("archived")}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-right">
                        <IconActionButton
                          icon="trash"
                          label={t("deleteBus")}
                          onClick={() => setDeleteTarget(bus)}
                          destructive
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="divide-y divide-stone-200 border-t border-stone-200 sm:hidden">
              {buses.map((bus) => (
                <li key={bus.id} className="flex items-start justify-between gap-4 p-5">
                  <div>
                    <p className="font-semibold">{bus.plateNumber}</p>
                    <p className="mt-1 text-sm text-stone-600">{t("seatCapacity", { count: bus.totalSeats })}</p>
                    {!bus.isActive && (
                      <span className="mt-2 inline-flex rounded-md border border-stone-200 bg-stone-100 px-2.5 py-1 text-xs font-semibold text-stone-600">
                        {t("archived")}
                      </span>
                    )}
                  </div>
                  <IconActionButton
                    icon="trash"
                    label={t("deleteBus")}
                    onClick={() => setDeleteTarget(bus)}
                    destructive
                  />
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <OperatorToast
        toast={toast}
        closeLabel={tCommon("close")}
        onDismiss={() => setToast(null)}
      />
      <OperatorDialog
        isOpen={Boolean(deleteTarget)}
        title={t("deleteBusTitle", {
          plate: deleteTarget?.plateNumber ?? "",
        })}
        description={t("deleteBusDescription")}
        closeLabel={tCommon("close")}
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button
              type="button"
              data-autofocus
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="awash-secondary"
            >
              {tCommon("cancel")}
            </button>
            {deleteTarget &&
              deleteTarget.upcomingTrips.length === 0 &&
              (deleteTarget._count.trips === 0 || deleteTarget.isActive) && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleBusRemoval()}
                  className={
                    deleteTarget._count.trips === 0
                      ? "inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-50"
                      : "awash-primary"
                  }
                >
                  {deleting
                    ? t("saving")
                    : deleteTarget._count.trips > 0
                      ? t("archiveBus")
                      : t("deleteBus")}
                </button>
              )}
          </>
        }
      >
        {deleteTarget && (
          <div>
            <p className="rounded-xl bg-stone-950 px-4 py-3 text-xl font-black tracking-wide text-white">
              {deleteTarget.plateNumber}
            </p>
            {deleteTarget.upcomingTrips.length > 0 ? (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-950">
                <p className="font-bold">{t("itemInUse")}</p>
                <p className="mt-1">{t("busUpcomingEffect")}</p>
                <ul className="mt-3 space-y-2">
                  {deleteTarget.upcomingTrips.map((trip) => (
                    <li key={trip.id} className="rounded-lg bg-white/70 px-3 py-2">
                      <span className="font-semibold">
                        {cityLabel(trip.route.origin, locale, {
                          en: trip.route.originEn,
                          am: trip.route.originAm,
                        })}{" "}
                        →{" "}
                        {cityLabel(trip.route.destination, locale, {
                          en: trip.route.destinationEn,
                          am: trip.route.destinationAm,
                        })}
                      </span>
                      <span className="block text-xs text-red-800">
                        {format.dateTime(new Date(trip.date), {
                          dateStyle: "medium",
                          timeZone: "UTC",
                        })}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : deleteTarget._count.trips > 0 ? (
              <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
                <p className="font-semibold">{t("itemInUse")}</p>
                <p className="mt-1">
                  {deleteTarget.isActive
                    ? t("busArchiveEffect", {
                        count: deleteTarget._count.trips,
                      })
                    : t("busAlreadyArchived")}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
                <p>{t("busDeleteEffect")}</p>
                <p className="mt-1 font-semibold">{t("cannotUndo")}</p>
              </div>
            )}
          </div>
        )}
      </OperatorDialog>
    </div>
  );
}

function TripsTab({ onDataChanged }: { onDataChanged: () => void }) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("operator");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<RouteRecord[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ routeId: "", busId: "", date: "", departureTime: "", arrivalTime: "", price: "" });
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Trip | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [tripView, setTripView] = useState<
    "active" | "completed" | "cancelled" | "archived" | "all"
  >("active");

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const responses = await Promise.all([
        fetch(`/api/operator/trips?view=${tripView}`),
        fetch("/api/operator/routes"),
        fetch("/api/operator/buses"),
      ]);
      const failed = responses.find((response) => !response.ok);
      if (failed) {
        const code = await readApiErrorCode(failed);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("LOAD_TRIPS_FAILED"));
      }
      const [tripData, routeData, busData] = (await Promise.all(responses.map((response) => response.json()))) as [Trip[], RouteRecord[], Bus[]];
      setTrips(tripData);
      setRoutes(routeData);
      setBuses(busData);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : tErrors("LOAD_TRIPS_FAILED"));
    } finally {
      setLoading(false);
    }
  }, [tErrors, tripView]);

  useEffect(() => {
    queueMicrotask(() => void fetchData());
  }, [fetchData]);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const price = Number(form.price);
    if (Object.values(form).some((value) => !value)) {
      setFeedback({ type: "error", text: t("allFieldsRequired") });
      return;
    }
    if (!Number.isFinite(price) || price < 1) {
      setFeedback({ type: "error", text: t("priceMinimum") });
      return;
    }
    if (form.arrivalTime <= form.departureTime) {
      setFeedback({ type: "error", text: t("arrivalAfterDeparture") });
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch("/api/operator/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, price }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("CREATE_TRIP_FAILED"));
      }
      const created = (await response.json()) as Trip;
      if (tripView === "active" || tripView === "all") {
        setTrips((current) => [created, ...current.filter((trip) => trip.id !== created.id)]);
      }
      setForm({ routeId: "", busId: "", date: "", departureTime: "", arrivalTime: "", price: "" });
      setFeedback({ type: "success", text: t("tripScheduled") });
      onDataChanged();
    } catch (submitError) {
      setFeedback({ type: "error", text: submitError instanceof Error ? submitError.message : tErrors("CREATE_TRIP_FAILED") });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTripRemoval() {
    if (!deleteTarget) return;
    const action = deleteTarget.lifecycle.recommendedAction;
    if (action === "viewHistory") {
      setDeleteTarget(null);
      return;
    }

    setDeleting(true);
    try {
      const response = await fetch(`/api/operator/trips/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        outcome?: "deleted" | "cancelled" | "archived";
      };
      if (!response.ok) {
        const code = payload.error ?? "DELETE_TRIP_FAILED";
        setToast({
          type: "error",
          text: tErrors.has(code)
            ? tErrors(code)
            : tErrors("DELETE_TRIP_FAILED"),
        });
        await fetchData();
        return;
      }

      setDeleteTarget(null);
      setToast({
        type: "success",
        text:
          payload.outcome === "cancelled"
            ? t("tripCancelled")
            : payload.outcome === "archived"
              ? t("tripArchived")
              : t("tripDeleted"),
      });
      await fetchData();
      onDataChanged();
    } catch {
      setToast({
        type: "error",
        text: tErrors("DELETE_TRIP_FAILED"),
      });
    } finally {
      setDeleting(false);
    }
  }

  const formatDate = (value: string) =>
    format.dateTime(new Date(value), { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
  const formatTime = (value: string) =>
    format.dateTime(new Date(value), { hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
  const formatPrice = (value: string) =>
    format.number(Number(value), { style: "currency", currency: "ETB", maximumFractionDigits: 2 });
  const activeRoutes = routes.filter((route) => route.isActive);
  const activeBuses = buses.filter((bus) => bus.isActive);
  const actionLabel = (trip: Trip) =>
    trip.lifecycle.recommendedAction === "delete"
      ? t("deleteTrip")
      : trip.lifecycle.recommendedAction === "cancel"
        ? t("cancelTrip")
        : trip.lifecycle.recommendedAction === "archive"
          ? t("archiveTrip")
          : t("viewHistory");

  return (
    <div className="space-y-6">
      <div>
        <p className="awash-section-label">{t("scheduleManagement")}</p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("trips")}</h1>
      </div>
      <form onSubmit={handleSubmit} className="awash-card p-5 sm:p-7">
        <SectionHeading title={t("scheduleTrip")} description={t("scheduleTripDescription")} />
        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <label className="awash-label sm:col-span-2">
            {tCommon("route")}
            <select value={form.routeId} onChange={(event) => updateField("routeId", event.target.value)} className="awash-input">
              <option value="">{t("selectRoute")}</option>
              {activeRoutes.map((route) => <option key={route.id} value={route.id}>{routeLabel(route, locale)}</option>)}
            </select>
          </label>
          <label className="awash-label">
            {tCommon("bus")}
            <select value={form.busId} onChange={(event) => updateField("busId", event.target.value)} className="awash-input">
              <option value="">{t("selectBus")}</option>
              {activeBuses.map((bus) => <option key={bus.id} value={bus.id}>{bus.plateNumber}</option>)}
            </select>
          </label>
          <label className="awash-label">
            {tCommon("date")}
            <input type="date" min={new Date().toISOString().slice(0, 10)} value={form.date} onChange={(event) => updateField("date", event.target.value)} className="awash-input" />
          </label>
          <label className="awash-label">
            {t("departureTime")}
            <input type="time" value={form.departureTime} onChange={(event) => updateField("departureTime", event.target.value)} className="awash-input" />
          </label>
          <label className="awash-label">
            {t("arrivalTime")}
            <input type="time" value={form.arrivalTime} onChange={(event) => updateField("arrivalTime", event.target.value)} className="awash-input" />
          </label>
          <label className="awash-label">
            {tCommon("price")}
            <input type="number" min={1} step="0.01" value={form.price} onChange={(event) => updateField("price", event.target.value)} className="awash-input" />
          </label>
        </div>
        {activeRoutes.length === 0 && !loading && <p className="mt-4 text-sm text-amber-800">{t("routeNeededForTrip")}</p>}
        {feedback && <p className={`mt-5 ${feedback.type === "success" ? "awash-alert-success" : "awash-alert-error"}`} role="status">{feedback.text}</p>}
        <button type="submit" disabled={submitting || activeRoutes.length === 0 || activeBuses.length === 0} className="awash-primary mt-5">
          {submitting ? t("scheduling") : t("scheduleTripButton")}
        </button>
      </form>
      <section>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-bold">{t("existingTrips")}</h2>
          <label className="awash-label min-w-44">
            {tCommon("status")}
            <select
              value={tripView}
              onChange={(event) =>
                setTripView(
                  event.target.value as
                    | "active"
                    | "completed"
                    | "cancelled"
                    | "archived"
                    | "all",
                )
              }
              className="awash-input"
            >
              <option value="active">{t("active")}</option>
              <option value="completed">{t("completed")}</option>
              <option value="cancelled">{t("cancelled")}</option>
              <option value="archived">{t("archived")}</option>
              <option value="all">{t("all")}</option>
            </select>
          </label>
        </div>
        {loading ? (
          <div className="awash-card p-6 text-sm text-stone-600">{t("loadingTrips")}</div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void fetchData()} />
        ) : trips.length === 0 ? (
          <div className="awash-card p-6 text-sm text-stone-600">{t("noTrips")}</div>
        ) : (
          <>
            <div className="hidden overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm md:block">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
                  <tr>
                    <th className="px-5 py-3">{tCommon("route")}</th>
                    <th className="px-5 py-3">{tCommon("bus")}</th>
                    <th className="px-5 py-3">{tCommon("date")}</th>
                    <th className="px-5 py-3">{tCommon("price")}</th>
                    <th className="px-5 py-3">{tCommon("status")}</th>
                    <th className="px-5 py-3 text-right">{tCommon("actions")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {trips.map((trip) => (
                    <tr key={trip.id}>
                      <td className="px-5 py-4 font-semibold">{routeLabel(trip.route, locale)}</td>
                      <td className="px-5 py-4 text-stone-700">{trip.bus.plateNumber}</td>
                      <td className="px-5 py-4 text-stone-700">
                        {formatDate(trip.date)}
                        <span className="mt-0.5 block text-xs text-stone-500">{formatTime(trip.departureTime)} – {formatTime(trip.arrivalTime)}</span>
                      </td>
                      <td className="px-5 py-4 font-semibold">{formatPrice(trip.price)}</td>
                      <td className="px-5 py-4"><StatusBadge status={trip.status} /></td>
                      <td className="px-5 py-4 text-right">
                        {trip.lifecycle.canDelete ? (
                          <IconActionButton
                            icon="trash"
                            label={t("deleteTrip")}
                            onClick={() => setDeleteTarget(trip)}
                            destructive
                          />
                        ) : (
                          <button
                            type="button"
                            onClick={() => setDeleteTarget(trip)}
                            className="awash-secondary min-h-10 px-3 py-2 text-xs"
                          >
                            {actionLabel(trip)}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ul className="grid gap-4 md:hidden">
              {trips.map((trip) => (
                <li key={trip.id} className="awash-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-bold">{routeLabel(trip.route, locale)}</p>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={trip.status} />
                      {trip.lifecycle.canDelete ? (
                        <IconActionButton
                          icon="trash"
                          label={t("deleteTrip")}
                          onClick={() => setDeleteTarget(trip)}
                          destructive
                        />
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteTarget(trip)}
                          className="awash-secondary min-h-10 px-3 py-2 text-xs"
                        >
                          {actionLabel(trip)}
                        </button>
                      )}
                    </div>
                  </div>
                  <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-stone-200 pt-4 text-sm">
                    <div><dt className="text-xs text-stone-500">{tCommon("bus")}</dt><dd className="font-semibold">{trip.bus.plateNumber}</dd></div>
                    <div><dt className="text-xs text-stone-500">{tCommon("date")}</dt><dd className="font-semibold">{formatDate(trip.date)}</dd></div>
                    <div><dt className="text-xs text-stone-500">{t("departureTime")}</dt><dd className="font-semibold">{formatTime(trip.departureTime)}</dd></div>
                    <div><dt className="text-xs text-stone-500">{tCommon("price")}</dt><dd className="font-semibold text-awash-orange">{formatPrice(trip.price)}</dd></div>
                  </dl>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <OperatorToast
        toast={toast}
        closeLabel={tCommon("close")}
        onDismiss={() => setToast(null)}
      />
      <OperatorDialog
        isOpen={Boolean(deleteTarget)}
        title={
          deleteTarget
            ? deleteTarget.lifecycle.recommendedAction === "delete"
              ? t("deleteTripTitle")
              : deleteTarget.lifecycle.recommendedAction === "cancel"
                ? t("cancelTripTitle")
                : deleteTarget.lifecycle.recommendedAction === "archive"
                  ? t("archiveTripTitle")
                  : t("tripHistoryTitle")
            : t("deleteTripTitle")
        }
        description={t("deleteTripDescription")}
        closeLabel={tCommon("close")}
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button
              type="button"
              data-autofocus
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="awash-secondary"
            >
              {tCommon("cancel")}
            </button>
            {deleteTarget &&
              deleteTarget.lifecycle.recommendedAction !== "viewHistory" && (
                <button
                  type="button"
                  disabled={deleting}
                  onClick={() => void handleTripRemoval()}
                  className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-50"
                >
                  {deleting ? t("saving") : actionLabel(deleteTarget)}
                </button>
              )}
          </>
        }
      >
        {deleteTarget && (
          <div>
            <dl className="grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
              <InlineDetail label={tCommon("route")}>
                {routeLabel(deleteTarget.route, locale)}
              </InlineDetail>
              <InlineDetail label={tCommon("date")}>
                {formatDate(deleteTarget.date)}
              </InlineDetail>
              <InlineDetail label={t("departureTime")}>
                {formatTime(deleteTarget.departureTime)}
              </InlineDetail>
              <InlineDetail label={t("plateNumber")}>
                {deleteTarget.bus.plateNumber}
              </InlineDetail>
              <InlineDetail label={t("bookingRecords")}>
                {t("existingBookings", {
                  count: deleteTarget.lifecycle.bookingCount,
                })}
              </InlineDetail>
              {deleteTarget.lifecycle.refundRequiredCount > 0 && (
                <InlineDetail label={t("refundReview")}>
                  {t("refundRequiredCount", {
                    count: deleteTarget.lifecycle.refundRequiredCount,
                  })}
                </InlineDetail>
              )}
            </dl>
            {!deleteTarget.lifecycle.canDelete ? (
              <div className="mt-4 rounded-xl border border-red-300 bg-red-50 p-4 text-sm leading-6 text-red-950">
                <p className="font-bold">{t("tripHistoryPreserved")}</p>
                <p className="mt-1">
                  {deleteTarget.lifecycle.recommendedAction === "cancel"
                    ? t("tripCancelEffect")
                    : deleteTarget.lifecycle.recommendedAction === "archive"
                      ? t("tripArchiveEffect")
                      : t("tripViewHistoryEffect")}
                </p>
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
                <p>
                  {deleteTarget.lifecycle.deletableExpiredBookingCount > 0
                    ? t("tripDeleteExpiredEffect", {
                        count:
                          deleteTarget.lifecycle.deletableExpiredBookingCount,
                      })
                    : t("tripDeleteEffect")}
                </p>
                <p className="mt-1 font-semibold">{t("cannotUndo")}</p>
              </div>
            )}
          </div>
        )}
      </OperatorDialog>
    </div>
  );
}

function MessagesTab({ onDataChanged }: { onDataChanged: () => void }) {
  const format = useFormatter();
  const t = useTranslations("operator.messagesTab");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [messages, setMessages] = useState<ContactMessage[]>([]);
  const [selected, setSelected] = useState<ContactMessage | null>(null);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | MessageStatus>("");
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMessages = useCallback(
    async (nextPage: number, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(nextPage) });
        if (query) params.set("q", query);
        if (status) params.set("status", status);
        const response = await fetch(`/api/operator/messages?${params}`);
        if (!response.ok) {
          const code = await readApiErrorCode(response);
          throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("LOAD_MESSAGES_FAILED"));
        }
        const data = (await response.json()) as {
          messages: ContactMessage[];
          total: number;
          page: number;
          hasMore: boolean;
        };
        setMessages((current) => {
          const next = append ? [...current, ...data.messages] : data.messages;
          return [...new Map(next.map((message) => [message.id, message])).values()];
        });
        setPage(data.page);
        setHasMore(data.hasMore);
        setTotal(data.total);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : tErrors("LOAD_MESSAGES_FAILED"));
      } finally {
        setLoading(false);
      }
    },
    [query, status, tErrors],
  );

  useEffect(() => {
    queueMicrotask(() => void loadMessages(1));
  }, [loadMessages]);

  async function updateStatus(message: ContactMessage, nextStatus: MessageStatus) {
    setUpdating(true);
    setError(null);
    try {
      const response = await fetch(`/api/operator/messages/${message.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(tErrors.has(code) ? tErrors(code) : tErrors("UPDATE_MESSAGE_FAILED"));
      }
      const updated = (await response.json()) as ContactMessage;
      setMessages((current) => current.map((item) => item.id === updated.id ? updated : item));
      setSelected(updated);
      onDataChanged();
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : tErrors("UPDATE_MESSAGE_FAILED"));
    } finally {
      setUpdating(false);
    }
  }

  function openMessage(message: ContactMessage) {
    setSelected(message);
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessages([]);
    setQuery(queryDraft.trim());
  }

  const formatDateTime = (value: string) =>
    format.dateTime(new Date(value), { dateStyle: "medium", timeStyle: "short" });

  return (
    <section>
      <p className="awash-section-label">{t("eyebrow")}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">{t("title")}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">{t("description")}</p>

      <div className="awash-card mt-6 p-4 sm:p-5">
        <form onSubmit={handleSearch} className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
          <label className="awash-label">
            {t("search")}
            <input type="search" value={queryDraft} onChange={(event) => setQueryDraft(event.target.value)} placeholder={t("searchPlaceholder")} className="awash-input" />
          </label>
          <label className="awash-label">
            {t("filterStatus")}
            <select
              value={status}
              onChange={(event) => {
                setMessages([]);
                setStatus(event.target.value as "" | MessageStatus);
              }}
              className="awash-input"
            >
              <option value="">{t("allStatuses")}</option>
              <option value="NEW">{t("new")}</option>
              <option value="READ">{t("read")}</option>
              <option value="RESOLVED">{t("resolved")}</option>
            </select>
          </label>
          <button type="submit" className="awash-primary">{t("searchButton")}</button>
        </form>
      </div>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="font-bold">{t("inbox")}</h2>
        {!loading && !error && <p className="text-sm text-stone-500">{t("messageCount", { count: total })}</p>}
      </div>

      {error && <div className="mt-4"><ErrorState message={error} onRetry={() => void loadMessages(1)} /></div>}
      {loading && messages.length === 0 ? (
        <div className="awash-card mt-4 p-6 text-sm text-stone-600">{t("loading")}</div>
      ) : messages.length === 0 ? (
        <div className="awash-card mt-4 px-6 py-10 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-stone-500">{t("emptyDescription")}</p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-stone-200 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          {messages.map((message) => (
            <li key={message.id}>
              <button
                type="button"
                onClick={() => openMessage(message)}
                className="w-full px-4 py-4 text-left transition hover:bg-stone-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-awash-orange sm:px-5"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className={`truncate ${message.status === "NEW" ? "font-bold" : "font-semibold"}`}>{message.fullName}</p>
                    <p className="truncate text-xs text-stone-500">{message.email}{message.phone ? ` · ${message.phone}` : ""}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={message.status} />
                    <span className="text-xs text-stone-500">{formatDateTime(message.createdAt)}</span>
                  </div>
                </div>
                <p className="mt-3 text-sm font-semibold text-stone-800">{message.subject || t("noSubject")}</p>
                <p className="mt-1 line-clamp-2 text-sm leading-6 text-stone-600">
                  {message.message.replace(/\s+/g, " ").slice(0, 180)}
                </p>
              </button>
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <div className="mt-5 flex justify-center">
          <button type="button" disabled={loading} onClick={() => void loadMessages(page + 1, true)} className="awash-secondary">
            {loading ? t("loading") : t("loadMore")}
          </button>
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-stone-950/40 p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="message-title">
          <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-stone-200 bg-white px-5 py-4 sm:px-6">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-stone-500">{t("messageFrom")}</p>
                <h2 id="message-title" className="truncate text-lg font-bold">{selected.fullName}</h2>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-lg px-3 py-2 text-sm font-semibold text-stone-600 hover:bg-stone-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange">
                {tCommon("close")}
              </button>
            </div>
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={selected.status} />
                <span className="text-xs text-stone-500">{formatDateTime(selected.createdAt)}</span>
              </div>
              <dl className="mt-5 grid gap-4 rounded-xl bg-stone-50 p-4 text-sm sm:grid-cols-2">
                <div><dt className="text-xs font-semibold text-stone-500">{tCommon("email")}</dt><dd className="mt-1 break-all">{selected.email}</dd></div>
                {selected.phone && <div><dt className="text-xs font-semibold text-stone-500">{tCommon("phone")}</dt><dd className="mt-1">{selected.phone}</dd></div>}
                <div className="sm:col-span-2"><dt className="text-xs font-semibold text-stone-500">{t("subject")}</dt><dd className="mt-1 font-semibold">{selected.subject || t("noSubject")}</dd></div>
              </dl>
              <div className="mt-5">
                <p className="text-xs font-semibold text-stone-500">{t("message")}</p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-stone-800">{selected.message}</p>
              </div>
              <div className="mt-6 flex flex-wrap gap-2 border-t border-stone-200 pt-5">
                <a
                  href={`mailto:${encodeURIComponent(selected.email)}?subject=${encodeURIComponent(selected.subject ? `Re: ${selected.subject}` : t("replySubject"))}`}
                  className="awash-primary"
                >
                  {t("replyByEmail")}
                </a>
                {selected.status !== "RESOLVED" && (
                  <button type="button" disabled={updating} onClick={() => void updateStatus(selected, "RESOLVED")} className="awash-secondary">
                    {t("markResolved")}
                  </button>
                )}
                {selected.status !== "NEW" && (
                  <button type="button" disabled={updating} onClick={() => void updateStatus(selected, "NEW")} className="awash-secondary">
                    {t("reopenNew")}
                  </button>
                )}
                {selected.status === "NEW" && (
                  <button type="button" disabled={updating} onClick={() => void updateStatus(selected, "READ")} className="awash-secondary">
                    {t("markRead")}
                  </button>
                )}
              </div>
              <p className="mt-3 text-xs text-stone-500">{t("replyNote")}</p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
