"use client";

import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import OperatorDialog from "@/app/components/operator/OperatorDialog";
import {
  IconActionButton,
  InlineDetail,
  OperatorToast,
  type ToastMessage,
} from "@/app/components/operator/OperatorFeedback";
import { readApiErrorCode } from "@/lib/api-client";
import { cityLabel } from "@/lib/ethiopian-cities";

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED" | "ARCHIVED";
type BookingView =
  | "active"
  | "confirmed"
  | "expired"
  | "cancelled"
  | "completed"
  | "history";

type BookingRoute = {
  origin: string;
  destination: string;
  originEn: string | null;
  originAm: string | null;
  destinationEn: string | null;
  destinationAm: string | null;
};

type BookingItem = {
  id: string;
  seatNumber: number;
  status: BookingStatus;
  fullName: string;
  phone: string;
  email: string | null;
  holdExpiresAt: string | null;
  expiredAt: string | null;
  createdAt: string;
  deletion: {
    canDelete: boolean;
    reason: "BOOKING_NOT_EXPIRED" | "BOOKING_HAS_PAYMENT_HISTORY" | null;
  };
  hasPaymentHistory: boolean;
  refundRequired: boolean;
  trip: {
    date: string;
    departureTime: string;
    status: TripStatus;
    route: BookingRoute;
    bus: { plateNumber: string };
  };
};

type BookingDetails = Omit<BookingItem, "trip"> & {
  passenger: {
    id: string;
    fullName: string;
    email: string;
    phone: string;
  };
  trip: BookingItem["trip"] & {
    id: string;
    arrivalTime: string;
    price: string;
    bookedSeats: number;
    remainingSeats: number;
    bus: {
      plateNumber: string;
      totalSeats: number;
    };
  };
};

function StatusBadge({
  status,
}: {
  status: BookingStatus | TripStatus;
}) {
  const t = useTranslations("status");
  const styles =
    status === "CONFIRMED" || status === "COMPLETED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "CANCELLED" || status === "EXPIRED"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "PENDING"
          ? "border-amber-200 bg-amber-50 text-amber-800"
          : "border-blue-200 bg-blue-50 text-blue-800";

  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {t(status)}
    </span>
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
      <button
        type="button"
        onClick={onRetry}
        className="mt-2 font-semibold underline"
      >
        {t("retry")}
      </button>
    </div>
  );
}

export default function OperatorBookingsTab() {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("operator");
  const tBooking = useTranslations("operator.bookingDetails");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<BookingView>("active");
  const [date, setDate] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [detailsId, setDetailsId] = useState<string | null>(null);
  const [details, setDetails] = useState<BookingDetails | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BookingItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const fetchBookings = useCallback(
    async (nextPage: number, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({
          page: String(nextPage),
          sort,
          view,
        });
        if (query) params.set("q", query);
        if (date) params.set("date", date);

        const response = await fetch(`/api/operator/bookings?${params}`);
        if (!response.ok) {
          const code = await readApiErrorCode(response);
          throw new Error(
            tErrors.has(code)
              ? tErrors(code)
              : tErrors("LOAD_BOOKINGS_FAILED"),
          );
        }
        const data = (await response.json()) as {
          bookings: BookingItem[];
          total: number;
          page: number;
          hasMore: boolean;
        };
        setBookings((current) => {
          const next = append ? [...current, ...data.bookings] : data.bookings;
          return [
            ...new Map(
              next.map((booking) => [booking.id, booking]),
            ).values(),
          ];
        });
        setTotal(data.total);
        setPage(data.page);
        setHasMore(data.hasMore);
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : tErrors("LOAD_BOOKINGS_FAILED"),
        );
      } finally {
        setLoading(false);
      }
    },
    [date, query, sort, tErrors, view],
  );

  useEffect(() => {
    queueMicrotask(() => void fetchBookings(1));
  }, [fetchBookings]);

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
      timeZone: "Africa/Addis_Ababa",
    });
  const formatPrice = (value: string) =>
    format.number(Number(value), {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: 2,
    });

  function bookingRouteLabel(booking: BookingItem | BookingDetails) {
    return `${cityLabel(booking.trip.route.origin, locale, {
      en: booking.trip.route.originEn,
      am: booking.trip.route.originAm,
    })} → ${cityLabel(booking.trip.route.destination, locale, {
      en: booking.trip.route.destinationEn,
      am: booking.trip.route.destinationAm,
    })}`;
  }

  async function openDetails(bookingId: string) {
    setDetailsId(bookingId);
    setDetails(null);
    setDetailsError(null);
    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/operator/bookings/${bookingId}`);
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code)
            ? tErrors(code)
            : tErrors("LOAD_BOOKING_DETAILS_FAILED"),
        );
      }
      setDetails((await response.json()) as BookingDetails);
    } catch (loadError) {
      setDetailsError(
        loadError instanceof Error
          ? loadError.message
          : tErrors("LOAD_BOOKING_DETAILS_FAILED"),
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBookings([]);
    setQuery(queryDraft.trim());
  }

  function clearFilters() {
    setBookings([]);
    setQueryDraft("");
    setQuery("");
    setView("active");
    setDate("");
    setSort("newest");
  }

  const filtersActive = Boolean(
    query || view !== "active" || date || sort !== "newest",
  );

  async function deleteBooking() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/operator/bookings/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code) ? tErrors(code) : tErrors("BOOKING_DELETE_UNSAFE"),
        );
      }
      setDeleteTarget(null);
      setToast({ type: "success", text: t("expiredBookingDeleted") });
      await fetchBookings(1);
    } catch (deleteError) {
      setToast({
        type: "error",
        text:
          deleteError instanceof Error
            ? deleteError.message
            : tErrors("BOOKING_DELETE_UNSAFE"),
      });
    } finally {
      setDeleting(false);
    }
  }

  async function clearExpiredBookings() {
    setClearing(true);
    try {
      const response = await fetch("/api/operator/bookings", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear-eligible-expired" }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code) ? tErrors(code) : tErrors("BOOKING_DELETE_UNSAFE"),
        );
      }
      const result = (await response.json()) as { deleted: number };
      setToast({
        type: "success",
        text: t("expiredBookingsCleared", { count: result.deleted }),
      });
      await fetchBookings(1);
    } catch (clearError) {
      setToast({
        type: "error",
        text:
          clearError instanceof Error
            ? clearError.message
            : tErrors("BOOKING_DELETE_UNSAFE"),
      });
    } finally {
      setClearing(false);
    }
  }

  return (
    <section>
      <p className="awash-section-label">{t("bookingManagement")}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {t("bookingRecords")}
      </h1>

      <form
        onSubmit={handleSearch}
        className="awash-card mt-6 grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(240px,1fr)_170px_170px_150px_auto]"
      >
        <label className="awash-label">
          {t("searchBookings")}
          <input
            type="search"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder={t("searchBookingsPlaceholder")}
            className="awash-input"
          />
        </label>
        <label className="awash-label">
          {tCommon("status")}
          <select
            value={view}
            onChange={(event) => {
              setBookings([]);
              setView(event.target.value as BookingView);
            }}
            className="awash-input"
          >
            <option value="active">{t("active")}</option>
            <option value="confirmed">{t("confirmed")}</option>
            <option value="expired">{t("expired")}</option>
            <option value="cancelled">{t("cancelled")}</option>
            <option value="completed">{t("completed")}</option>
            <option value="history">{t("history")}</option>
          </select>
        </label>
        <label className="awash-label">
          {t("travelDate")}
          <input
            type="date"
            value={date}
            onChange={(event) => {
              setBookings([]);
              setDate(event.target.value);
            }}
            className="awash-input"
          />
        </label>
        <label className="awash-label">
          {tCommon("sort")}
          <select
            value={sort}
            onChange={(event) => {
              setBookings([]);
              setSort(event.target.value as "newest" | "oldest");
            }}
            className="awash-input"
          >
            <option value="newest">{t("sortNewest")}</option>
            <option value="oldest">{t("sortOldest")}</option>
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2 sm:col-span-2 xl:col-span-1">
          <button type="submit" className="awash-primary flex-1">
            {tCommon("search")}
          </button>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="awash-secondary flex-1"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      </form>

      <div className="mt-5 flex items-center justify-between gap-3">
        <h2 className="text-lg font-bold">{t("bookingList")}</h2>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {(view === "expired" || view === "history") && (
            <button
              type="button"
              disabled={clearing}
              onClick={() => void clearExpiredBookings()}
              className="awash-secondary"
            >
              {clearing ? t("saving") : t("clearEligibleExpiredBookings")}
            </button>
          )}
          {!loading && !error && (
            <p className="text-sm text-stone-500">
              {t("bookingCount", { count: total })}
            </p>
          )}
        </div>
      </div>

      {loading && bookings.length === 0 ? (
        <div
          aria-label={t("loadingBookings")}
          aria-busy="true"
          className="mt-4 grid gap-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="awash-card animate-pulse p-5">
              <div className="h-4 w-1/3 rounded bg-stone-200" />
              <div className="mt-3 h-3 w-2/3 rounded bg-stone-100" />
              <div className="mt-5 h-9 w-full rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="mt-5">
          <ErrorState
            message={error}
            onRetry={() => void fetchBookings(1)}
          />
        </div>
      ) : bookings.length === 0 ? (
        <div className="awash-card mt-4 px-6 py-10 text-center">
          <p className="font-semibold text-stone-900">
            {filtersActive ? t("noMatchingBookings") : t("noBookings")}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {filtersActive
              ? t("adjustBookingFilters")
              : t("noBookingsDescription")}
          </p>
          {filtersActive && (
            <button
              type="button"
              onClick={clearFilters}
              className="awash-secondary mt-5"
            >
              {t("clearFilters")}
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
                <tr>
                  <th className="px-5 py-3">{t("bookingId")}</th>
                  <th className="px-5 py-3">{tCommon("passenger")}</th>
                  <th className="px-5 py-3">{tCommon("route")}</th>
                  <th className="px-5 py-3">{tCommon("seat")}</th>
                  <th className="px-5 py-3">{tCommon("status")}</th>
                  <th className="px-5 py-3 text-right">
                    {tCommon("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td className="max-w-36 break-all px-5 py-4 font-mono text-xs text-stone-600">
                      {booking.id}
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{booking.fullName}</p>
                      <p className="text-xs text-stone-500">{booking.phone}</p>
                    </td>
                    <td className="px-5 py-4 text-stone-700">
                      {bookingRouteLabel(booking)}
                      <span className="mt-0.5 block text-xs text-stone-500">
                        {formatDate(booking.trip.date)},{" "}
                        {formatTime(booking.trip.departureTime)}
                      </span>
                    </td>
                    <td className="px-5 py-4 font-semibold">
                      {booking.seatNumber}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex flex-wrap gap-1">
                        <StatusBadge status={booking.status} />
                        {booking.trip.status === "CANCELLED" && (
                          <StatusBadge status="CANCELLED" />
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <IconActionButton
                          icon="eye"
                          label={t("viewDetails")}
                          onClick={() => void openDetails(booking.id)}
                          showText
                        />
                        {booking.deletion.canDelete && (
                          <IconActionButton
                            icon="trash"
                            label={t("deleteExpiredBooking")}
                            onClick={() => setDeleteTarget(booking)}
                            destructive
                          />
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <ul className="mt-4 grid gap-4 lg:hidden">
            {bookings.map((booking) => (
              <li key={booking.id} className="awash-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold">{booking.fullName}</p>
                    <p className="text-xs text-stone-500">{booking.phone}</p>
                    <p className="mt-1 break-all font-mono text-[11px] text-stone-500">
                      {booking.id}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <StatusBadge status={booking.status} />
                    {booking.trip.status === "CANCELLED" && (
                      <StatusBadge status="CANCELLED" />
                    )}
                  </div>
                </div>
                <p className="mt-4 border-t border-stone-200 pt-4 text-sm font-semibold">
                  {bookingRouteLabel(booking)}
                </p>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-600">
                  <span>{formatDate(booking.trip.date)}</span>
                  <span>{formatTime(booking.trip.departureTime)}</span>
                  <span>
                    {tCommon("seat")} {booking.seatNumber}
                  </span>
                </div>
                <div className="mt-4 flex justify-end gap-2">
                  <IconActionButton
                    icon="eye"
                    label={t("viewDetails")}
                    onClick={() => void openDetails(booking.id)}
                    showText
                  />
                  {booking.deletion.canDelete && (
                    <IconActionButton
                      icon="trash"
                      label={t("deleteExpiredBooking")}
                      onClick={() => setDeleteTarget(booking)}
                      destructive
                    />
                  )}
                </div>
              </li>
            ))}
          </ul>
          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => void fetchBookings(page + 1, true)}
                className="awash-secondary"
              >
                {loading ? t("loadingBookings") : t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}

      <OperatorDialog
        isOpen={Boolean(detailsId)}
        title={t("bookingDetailsTitle")}
        description={
          details
            ? t("bookingDetailsDescription", { id: details.id })
            : undefined
        }
        closeLabel={tCommon("close")}
        onClose={() => {
          setDetailsId(null);
          setDetails(null);
          setDetailsError(null);
        }}
      >
        {detailsLoading ? (
          <div aria-busy="true" className="space-y-4">
            <div className="h-20 animate-pulse rounded-xl bg-stone-100" />
            <div className="h-36 animate-pulse rounded-xl bg-stone-100" />
            <div className="h-44 animate-pulse rounded-xl bg-stone-100" />
          </div>
        ) : detailsError ? (
          <ErrorState
            message={detailsError}
            onRetry={() => detailsId && void openDetails(detailsId)}
          />
        ) : details ? (
          <div className="space-y-6">
            <section>
              <h3 className="text-base font-bold text-stone-950">
                {tBooking("booking")}
              </h3>
              <dl className="mt-3 grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
                <InlineDetail label={t("bookingId")}>
                  {details.id}
                </InlineDetail>
                <InlineDetail label={tCommon("status")}>
                  <StatusBadge status={details.status} />
                </InlineDetail>
                <InlineDetail label={tBooking("createdAt")}>
                  {formatDateTime(details.createdAt)}
                </InlineDetail>
                <InlineDetail label={tCommon("seat")}>
                  {details.seatNumber}
                </InlineDetail>
                <InlineDetail label={tCommon("price")}>
                  <span className="font-bold text-awash-orange">
                    {formatPrice(details.trip.price)}
                  </span>
                </InlineDetail>
              </dl>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <section className="rounded-xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-950">
                  {tBooking("accountHolder")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {tBooking("accountHolderDescription")}
                </p>
                <dl className="mt-4 space-y-4">
                  <InlineDetail label={tCommon("fullName")}>
                    {details.passenger.fullName}
                  </InlineDetail>
                  <InlineDetail label={tCommon("email")}>
                    {details.passenger.email}
                  </InlineDetail>
                  {details.passenger.phone && (
                    <InlineDetail label={tCommon("phone")}>
                      {details.passenger.phone}
                    </InlineDetail>
                  )}
                </dl>
              </section>

              <section className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                <h3 className="font-bold text-stone-950">
                  {tBooking("traveler")}
                </h3>
                <p className="mt-1 text-xs leading-5 text-stone-500">
                  {tBooking("travelerDescription")}
                </p>
                <dl className="mt-4 space-y-4">
                  <InlineDetail label={tCommon("fullName")}>
                    {details.fullName}
                  </InlineDetail>
                  <InlineDetail label={tCommon("phone")}>
                    {details.phone}
                  </InlineDetail>
                  {details.email && (
                    <InlineDetail label={tCommon("email")}>
                      {details.email}
                    </InlineDetail>
                  )}
                </dl>
              </section>
            </div>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 className="text-base font-bold text-stone-950">
                  {tBooking("trip")}
                </h3>
                <StatusBadge status={details.trip.status} />
              </div>
              <dl className="mt-3 grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
                <div className="sm:col-span-2 lg:col-span-3">
                  <InlineDetail label={tCommon("route")}>
                    {bookingRouteLabel(details)}
                  </InlineDetail>
                </div>
                <InlineDetail label={t("travelDate")}>
                  {formatDate(details.trip.date)}
                </InlineDetail>
                <InlineDetail label={t("departureTime")}>
                  {formatTime(details.trip.departureTime)}
                </InlineDetail>
                <InlineDetail label={t("arrivalTime")}>
                  {formatTime(details.trip.arrivalTime)}
                </InlineDetail>
                <InlineDetail label={t("plateNumber")}>
                  {details.trip.bus.plateNumber}
                </InlineDetail>
                <InlineDetail label={t("totalSeats")}>
                  {details.trip.bus.totalSeats}
                </InlineDetail>
                <InlineDetail label={tBooking("remainingSeats")}>
                  {details.trip.remainingSeats}
                </InlineDetail>
              </dl>
            </section>
          </div>
        ) : null}
      </OperatorDialog>
      <OperatorDialog
        isOpen={Boolean(deleteTarget)}
        title={t("deleteExpiredBookingTitle")}
        description={t("deleteExpiredBookingDescription")}
        closeLabel={tCommon("close")}
        busy={deleting}
        onClose={() => setDeleteTarget(null)}
        footer={
          <>
            <button
              type="button"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
              className="awash-secondary"
            >
              {tCommon("cancel")}
            </button>
            <button
              type="button"
              disabled={deleting}
              onClick={() => void deleteBooking()}
              className="inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-50"
            >
              {deleting ? t("saving") : t("deleteExpiredBooking")}
            </button>
          </>
        }
      >
        {deleteTarget && (
          <div>
            <dl className="grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
              <InlineDetail label={tCommon("passenger")}>
                {deleteTarget.fullName}
              </InlineDetail>
              <InlineDetail label={tCommon("route")}>
                {bookingRouteLabel(deleteTarget)}
              </InlineDetail>
              <InlineDetail label={tCommon("seat")}>
                {deleteTarget.seatNumber}
              </InlineDetail>
              <InlineDetail label={t("expirationTime")}>
                {formatDateTime(
                  deleteTarget.expiredAt ??
                    deleteTarget.holdExpiresAt ??
                    deleteTarget.createdAt,
                )}
              </InlineDetail>
            </dl>
            <p className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-900">
              {t("expiredBookingDeleteEffect")}
            </p>
          </div>
        )}
      </OperatorDialog>
      <OperatorToast
        toast={toast}
        closeLabel={tCommon("close")}
        onDismiss={() => setToast(null)}
      />
    </section>
  );
}
