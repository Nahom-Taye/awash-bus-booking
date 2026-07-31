"use client";

import Image from "next/image";
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

type PaymentMethod = "TELEBIRR" | "CBE";
type PaymentStatus =
  | "PENDING"
  | "VERIFIED"
  | "REJECTED"
  | "EXPIRED"
  | "REFUNDED";
type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED" | "EXPIRED";
type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";

type OperatorPayment = {
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
  passenger: {
    fullName: string;
    email: string;
    phone: string;
  };
  booking: {
    id: string;
    seatNumber: number;
    fullName: string;
    phone: string;
    email: string | null;
    status: BookingStatus;
    holdExpiresAt?: string | null;
    trip: {
      id: string;
      date: string;
      departureTime: string;
      arrivalTime: string;
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
        totalSeats?: number;
      };
    };
  };
  verifiedBy?: {
    fullName: string;
    email: string;
  } | null;
};

export default function OperatorPaymentsTab({
  onDataChanged,
}: {
  onDataChanged: () => void;
}) {
  const locale = useLocale();
  const format = useFormatter();
  const t = useTranslations("operator.paymentsTab");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const tPaymentStatus = useTranslations("paymentStatus");
  const [payments, setPayments] = useState<OperatorPayment[]>([]);
  const [queryDraft, setQueryDraft] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"" | PaymentStatus>("");
  const [method, setMethod] = useState<"" | PaymentMethod>("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [details, setDetails] = useState<OperatorPayment | null>(null);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [detailsError, setDetailsError] = useState<string | null>(null);
  const [action, setAction] = useState<"verify" | "reject" | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadPayments = useCallback(
    async (nextPage: number, append = false) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ page: String(nextPage) });
        if (query) params.set("q", query);
        if (status) params.set("status", status);
        if (method) params.set("method", method);
        const response = await fetch(`/api/operator/payments?${params}`);
        if (!response.ok) {
          const code = await readApiErrorCode(response);
          throw new Error(
            tErrors.has(code)
              ? tErrors(code)
              : tErrors("LOAD_PAYMENTS_FAILED"),
          );
        }
        const data = (await response.json()) as {
          payments: OperatorPayment[];
          total: number;
          page: number;
          hasMore: boolean;
        };
        setPayments((current) => {
          const next = append
            ? [...current, ...data.payments]
            : data.payments;
          return [
            ...new Map(
              next.map((payment) => [payment.id, payment]),
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
            : tErrors("LOAD_PAYMENTS_FAILED"),
        );
      } finally {
        setLoading(false);
      }
    },
    [method, query, status, tErrors],
  );

  useEffect(() => {
    queueMicrotask(() => void loadPayments(1));
  }, [loadPayments]);

  async function openDetails(paymentId: string) {
    setSelectedId(paymentId);
    setDetails(null);
    setDetailsError(null);
    setAction(null);
    setRejectionReason("");
    setDetailsLoading(true);
    try {
      const response = await fetch(`/api/operator/payments/${paymentId}`);
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code)
            ? tErrors(code)
            : tErrors("LOAD_PAYMENT_DETAILS_FAILED"),
        );
      }
      setDetails((await response.json()) as OperatorPayment);
    } catch (loadError) {
      setDetailsError(
        loadError instanceof Error
          ? loadError.message
          : tErrors("LOAD_PAYMENT_DETAILS_FAILED"),
      );
    } finally {
      setDetailsLoading(false);
    }
  }

  async function submitAction() {
    if (!details || !action) return;
    if (action === "reject" && rejectionReason.trim().length < 5) return;
    setSaving(true);
    setDetailsError(null);
    try {
      const response = await fetch(`/api/operator/payments/${details.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          rejectionReason:
            action === "reject" ? rejectionReason.trim() : undefined,
        }),
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code)
            ? tErrors(code)
            : tErrors("UPDATE_PAYMENT_FAILED"),
        );
      }

      setToast({
        type: "success",
        text: action === "verify" ? t("verified") : t("rejected"),
      });
      closeDialog();
      setPayments([]);
      await loadPayments(1);
      onDataChanged();
    } catch (actionError) {
      setDetailsError(
        actionError instanceof Error
          ? actionError.message
          : tErrors("UPDATE_PAYMENT_FAILED"),
      );
    } finally {
      setSaving(false);
    }
  }

  function closeDialog() {
    setSelectedId(null);
    setDetails(null);
    setDetailsError(null);
    setAction(null);
    setRejectionReason("");
  }

  function handleSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPayments([]);
    setQuery(queryDraft.trim());
  }

  function clearFilters() {
    setPayments([]);
    setQueryDraft("");
    setQuery("");
    setStatus("");
    setMethod("");
  }

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
  const formatPrice = (value: string) =>
    format.number(Number(value), {
      style: "currency",
      currency: "ETB",
      maximumFractionDigits: 2,
    });
  const routeLabel = (payment: OperatorPayment) =>
    `${cityLabel(payment.booking.trip.route.origin, locale, {
      en: payment.booking.trip.route.originEn,
      am: payment.booking.trip.route.originAm,
    })} → ${cityLabel(payment.booking.trip.route.destination, locale, {
      en: payment.booking.trip.route.destinationEn,
      am: payment.booking.trip.route.destinationAm,
    })}`;
  const filtersActive = Boolean(query || status || method);

  return (
    <section>
      <p className="awash-section-label">{t("eyebrow")}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>

      <form
        onSubmit={handleSearch}
        className="awash-card mt-6 grid gap-3 p-4 sm:grid-cols-2 sm:p-5 xl:grid-cols-[minmax(260px,1fr)_180px_180px_auto]"
      >
        <label className="awash-label">
          {t("search")}
          <input
            type="search"
            value={queryDraft}
            onChange={(event) => setQueryDraft(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="awash-input"
          />
        </label>
        <label className="awash-label">
          {tCommon("status")}
          <select
            value={status}
            onChange={(event) => {
              setPayments([]);
              setStatus(event.target.value as "" | PaymentStatus);
            }}
            className="awash-input"
          >
            <option value="">{t("allStatuses")}</option>
            <option value="PENDING">{tPaymentStatus("PENDING")}</option>
            <option value="VERIFIED">{tPaymentStatus("VERIFIED")}</option>
            <option value="REJECTED">{tPaymentStatus("REJECTED")}</option>
            <option value="EXPIRED">{tPaymentStatus("EXPIRED")}</option>
            <option value="REFUNDED">{tPaymentStatus("REFUNDED")}</option>
          </select>
        </label>
        <label className="awash-label">
          {t("method")}
          <select
            value={method}
            onChange={(event) => {
              setPayments([]);
              setMethod(event.target.value as "" | PaymentMethod);
            }}
            className="awash-input"
          >
            <option value="">{t("allMethods")}</option>
            <option value="TELEBIRR">Telebirr</option>
            <option value="CBE">{t("cbeName")}</option>
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
        <h2 className="text-lg font-bold">{t("paymentList")}</h2>
        {!loading && !error && (
          <p className="text-sm text-stone-500">
            {t("paymentCount", { count: total })}
          </p>
        )}
      </div>

      {loading && payments.length === 0 ? (
        <div
          aria-label={t("loading")}
          aria-busy="true"
          className="mt-4 grid gap-3"
        >
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="awash-card animate-pulse p-5">
              <div className="h-4 w-1/3 rounded bg-stone-200" />
              <div className="mt-3 h-3 w-2/3 rounded bg-stone-100" />
              <div className="mt-5 h-9 rounded bg-stone-100" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="awash-alert-error mt-5">
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void loadPayments(1)}
            className="mt-2 font-semibold underline"
          >
            {tCommon("retry")}
          </button>
        </div>
      ) : payments.length === 0 ? (
        <div className="awash-card mt-4 px-6 py-10 text-center">
          <p className="font-semibold">{t("emptyTitle")}</p>
          <p className="mt-1 text-sm text-stone-500">
            {filtersActive
              ? t("emptyFilteredDescription")
              : t("emptyDescription")}
          </p>
        </div>
      ) : (
        <>
          <div className="mt-4 hidden overflow-x-auto rounded-xl border border-stone-200 bg-white shadow-sm lg:block">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-xs font-semibold text-stone-500">
                <tr>
                  <th className="px-5 py-3">{t("passenger")}</th>
                  <th className="px-5 py-3">{tCommon("route")}</th>
                  <th className="px-5 py-3">{t("method")}</th>
                  <th className="px-5 py-3">{t("reference")}</th>
                  <th className="px-5 py-3">{tCommon("status")}</th>
                  <th className="px-5 py-3 text-right">
                    {tCommon("actions")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-200">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="px-5 py-4">
                      <p className="font-semibold">
                        {payment.passenger.fullName}
                      </p>
                      <p className="text-xs text-stone-500">
                        {payment.passenger.email}
                      </p>
                      <p className="text-xs text-stone-500">
                        {payment.passenger.phone}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <p className="font-semibold">{routeLabel(payment)}</p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {formatDate(payment.booking.trip.date)},{" "}
                        {formatTime(payment.booking.trip.departureTime)}
                      </p>
                      <p className="mt-0.5 text-xs text-stone-500">
                        {payment.booking.trip.bus.plateNumber} ·{" "}
                        {tCommon("seat")} {payment.booking.seatNumber}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <PaymentMethodMark
                        method={payment.method}
                        cbeName={t("cbeName")}
                      />
                      <p className="mt-1 font-semibold">
                        {formatPrice(payment.amount)}
                      </p>
                    </td>
                    <td className="max-w-48 break-all px-5 py-4">
                      <p className="font-mono text-xs">
                        {payment.transactionReference}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {payment.senderName} · {payment.senderIdentifier}
                      </p>
                      <p className="mt-1 text-xs text-stone-500">
                        {formatDateTime(payment.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4">
                      <PaymentStatusBadge
                        label={tPaymentStatus(payment.status)}
                        status={payment.status}
                      />
                    </td>
                    <td className="px-5 py-4 text-right">
                      <IconActionButton
                        icon="eye"
                        label={t("reviewPayment")}
                        onClick={() => void openDetails(payment.id)}
                        showText
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="mt-4 grid gap-4 lg:hidden">
            {payments.map((payment) => (
              <li key={payment.id} className="awash-card p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">
                      {payment.passenger.fullName}
                    </p>
                    <p className="text-xs text-stone-500">
                      {payment.passenger.email}
                    </p>
                    <p className="text-xs text-stone-500">
                      {payment.passenger.phone}
                    </p>
                  </div>
                  <PaymentStatusBadge
                    label={tPaymentStatus(payment.status)}
                    status={payment.status}
                  />
                </div>
                <p className="mt-4 border-t border-stone-200 pt-4 text-sm font-semibold">
                  {routeLabel(payment)}
                </p>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                  <PaymentMethodMark
                    method={payment.method}
                    cbeName={t("cbeName")}
                  />
                  <span className="font-bold text-awash-orange">
                    {formatPrice(payment.amount)}
                  </span>
                </div>
                <p className="mt-3 break-all font-mono text-xs text-stone-500">
                  {payment.transactionReference}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {payment.senderName} · {payment.senderIdentifier}
                </p>
                <p className="mt-1 text-xs text-stone-500">
                  {payment.booking.trip.bus.plateNumber} ·{" "}
                  {tCommon("seat")} {payment.booking.seatNumber} ·{" "}
                  {formatDateTime(payment.createdAt)}
                </p>
                <div className="mt-4 flex justify-end">
                  <IconActionButton
                    icon="eye"
                    label={t("reviewPayment")}
                    onClick={() => void openDetails(payment.id)}
                    showText
                  />
                </div>
              </li>
            ))}
          </ul>

          {hasMore && (
            <div className="mt-6 flex justify-center">
              <button
                type="button"
                disabled={loading}
                onClick={() => void loadPayments(page + 1, true)}
                className="awash-secondary"
              >
                {loading ? t("loading") : t("loadMore")}
              </button>
            </div>
          )}
        </>
      )}

      <OperatorToast
        toast={toast}
        closeLabel={tCommon("close")}
        onDismiss={() => setToast(null)}
      />

      <OperatorDialog
        isOpen={Boolean(selectedId)}
        title={
          action === "verify"
            ? t("verifyTitle")
            : action === "reject"
              ? t("rejectTitle")
              : t("detailsTitle")
        }
        description={
          action === "verify"
            ? t("verifyDescription")
            : action === "reject"
              ? t("rejectDescription")
              : details
                ? t("detailsDescription", {
                    reference: details.transactionReference,
                  })
                : undefined
        }
        closeLabel={tCommon("close")}
        busy={saving}
        onClose={closeDialog}
        footer={
          details && !detailsLoading ? (
            action ? (
              <>
                <button
                  type="button"
                  data-autofocus
                  disabled={saving}
                  onClick={() => {
                    setAction(null);
                    setDetailsError(null);
                  }}
                  className="awash-secondary"
                >
                  {tCommon("cancel")}
                </button>
                <button
                  type="button"
                  disabled={
                    saving ||
                    (action === "reject" &&
                      rejectionReason.trim().length < 5)
                  }
                  onClick={() => void submitAction()}
                  className={
                    action === "reject"
                      ? "inline-flex min-h-11 items-center justify-center rounded-lg bg-red-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-red-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2 disabled:opacity-50"
                      : "inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2 disabled:opacity-50"
                  }
                >
                  {saving
                    ? t("saving")
                    : action === "verify"
                      ? t("verifyPayment")
                      : t("rejectPayment")}
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={closeDialog}
                  className="awash-secondary"
                >
                  {tCommon("close")}
                </button>
                {details.status === "PENDING" && (
                  <>
                    <button
                      type="button"
                      onClick={() => setAction("reject")}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg border border-red-200 bg-white px-5 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-700 focus-visible:ring-offset-2"
                    >
                      {t("rejectPayment")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAction("verify")}
                      className="inline-flex min-h-11 items-center justify-center rounded-lg bg-emerald-700 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-700 focus-visible:ring-offset-2"
                    >
                      {t("verifyPayment")}
                    </button>
                  </>
                )}
              </>
            )
          ) : undefined
        }
      >
        {detailsLoading ? (
          <div aria-busy="true" className="space-y-4">
            <div className="h-28 animate-pulse rounded-xl bg-stone-100" />
            <div className="h-40 animate-pulse rounded-xl bg-stone-100" />
            <div className="h-40 animate-pulse rounded-xl bg-stone-100" />
          </div>
        ) : detailsError ? (
          <div className="awash-alert-error">
            <p>{detailsError}</p>
            {!action && selectedId && (
              <button
                type="button"
                onClick={() => void openDetails(selectedId)}
                className="mt-2 font-semibold underline"
              >
                {tCommon("retry")}
              </button>
            )}
          </div>
        ) : details ? (
          action ? (
            <div>
              <div className="rounded-xl bg-stone-50 p-4">
                <p className="text-xs font-semibold text-stone-500">
                  {t("reference")}
                </p>
                <p className="mt-1 break-all font-mono text-sm font-bold">
                  {details.transactionReference}
                </p>
                <p className="mt-3 font-semibold">
                  {details.passenger.fullName} ·{" "}
                  {formatPrice(details.amount)}
                </p>
              </div>
              {action === "verify" ? (
                <p className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                  {t("verifyWarning")}
                </p>
              ) : (
                <label className="awash-label mt-4">
                  {t("rejectionReason")}
                  <textarea
                    data-autofocus
                    required
                    minLength={5}
                    maxLength={500}
                    rows={4}
                    value={rejectionReason}
                    onChange={(event) =>
                      setRejectionReason(event.target.value)
                    }
                    className="awash-input min-h-28 resize-y"
                  />
                  <span className="text-xs font-normal text-stone-500">
                    {t("rejectionReasonHelp")}
                  </span>
                </label>
              )}
            </div>
          ) : (
            <PaymentDetails
              payment={details}
              routeLabel={routeLabel(details)}
              formatDate={formatDate}
              formatTime={formatTime}
              formatDateTime={formatDateTime}
              formatPrice={formatPrice}
            />
          )
        ) : null}
      </OperatorDialog>
    </section>
  );
}

function PaymentDetails({
  payment,
  routeLabel,
  formatDate,
  formatTime,
  formatDateTime,
  formatPrice,
}: {
  payment: OperatorPayment;
  routeLabel: string;
  formatDate: (value: string) => string;
  formatTime: (value: string) => string;
  formatDateTime: (value: string) => string;
  formatPrice: (value: string) => string;
}) {
  const t = useTranslations("operator.paymentsTab");
  const tCommon = useTranslations("common");
  const tPaymentStatus = useTranslations("paymentStatus");

  return (
    <div className="space-y-6">
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <PaymentMethodMark
            method={payment.method}
            cbeName={t("cbeName")}
          />
          <PaymentStatusBadge
            label={tPaymentStatus(payment.status)}
            status={payment.status}
          />
        </div>
        <dl className="mt-4 grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
          <InlineDetail label={t("reference")}>
            <span className="break-all font-mono">
              {payment.transactionReference}
            </span>
          </InlineDetail>
          <InlineDetail label={tCommon("price")}>
            <span className="font-bold text-awash-orange">
              {formatPrice(payment.amount)}
            </span>
          </InlineDetail>
          <InlineDetail label={t("submissionDate")}>
            {formatDateTime(payment.createdAt)}
          </InlineDetail>
          {payment.verifiedAt && (
            <InlineDetail label={t("verifiedAt")}>
              {formatDateTime(payment.verifiedAt)}
            </InlineDetail>
          )}
          {payment.verifiedBy && (
            <InlineDetail label={t("verifiedBy")}>
              {payment.verifiedBy.fullName}
            </InlineDetail>
          )}
          {payment.rejectionReason && (
            <div className="sm:col-span-2">
              <InlineDetail label={t("rejectionReason")}>
                <span className="text-red-700">
                  {payment.rejectionReason}
                </span>
              </InlineDetail>
            </div>
          )}
        </dl>
      </section>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-stone-200 p-4">
          <h3 className="font-bold">{t("passengerAccount")}</h3>
          <dl className="mt-4 space-y-4">
            <InlineDetail label={tCommon("fullName")}>
              {payment.passenger.fullName}
            </InlineDetail>
            <InlineDetail label={tCommon("email")}>
              {payment.passenger.email}
            </InlineDetail>
            <InlineDetail label={tCommon("phone")}>
              {payment.passenger.phone}
            </InlineDetail>
          </dl>
        </section>
        <section className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
          <h3 className="font-bold">{t("traveler")}</h3>
          <dl className="mt-4 space-y-4">
            <InlineDetail label={tCommon("fullName")}>
              {payment.booking.fullName}
            </InlineDetail>
            <InlineDetail label={tCommon("phone")}>
              {payment.booking.phone}
            </InlineDetail>
            {payment.booking.email && (
              <InlineDetail label={tCommon("email")}>
                {payment.booking.email}
              </InlineDetail>
            )}
          </dl>
        </section>
      </div>

      <section>
        <h3 className="font-bold">{t("senderInformation")}</h3>
        <dl className="mt-3 grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2">
          <InlineDetail label={t("senderName")}>
            {payment.senderName}
          </InlineDetail>
          <InlineDetail label={t("senderIdentifier")}>
            {payment.senderIdentifier}
          </InlineDetail>
        </dl>
      </section>

      <section>
        <h3 className="font-bold">{t("bookingAndTrip")}</h3>
        <dl className="mt-3 grid gap-4 rounded-xl bg-stone-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="sm:col-span-2 lg:col-span-3">
            <InlineDetail label={tCommon("route")}>
              {routeLabel}
            </InlineDetail>
          </div>
          <InlineDetail label={t("bookingId")}>
            <span className="break-all font-mono">
              {payment.booking.id}
            </span>
          </InlineDetail>
          <InlineDetail label={tCommon("seat")}>
            {payment.booking.seatNumber}
          </InlineDetail>
          <InlineDetail label={t("tripDate")}>
            {formatDate(payment.booking.trip.date)}
          </InlineDetail>
          <InlineDetail label={t("departureTime")}>
            {formatTime(payment.booking.trip.departureTime)}
          </InlineDetail>
          <InlineDetail label={t("arrivalTime")}>
            {formatTime(payment.booking.trip.arrivalTime)}
          </InlineDetail>
          <InlineDetail label={t("busPlate")}>
            {payment.booking.trip.bus.plateNumber}
          </InlineDetail>
        </dl>
      </section>
    </div>
  );
}

function PaymentMethodMark({
  method,
  cbeName,
}: {
  method: PaymentMethod;
  cbeName: string;
}) {
  return method === "TELEBIRR" ? (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/images/payments/telebirr.png"
        alt="Telebirr"
        width={87}
        height={40}
        className="h-7 w-auto object-contain"
      />
      <span className="sr-only">Telebirr</span>
    </span>
  ) : (
    <span className="inline-flex items-center gap-2">
      <Image
        src="/images/payments/cbe-logo.jpg"
        alt="Commercial Bank of Ethiopia"
        width={151}
        height={148}
        className="h-8 w-auto object-contain"
      />
      <span className="sr-only">{cbeName}</span>
    </span>
  );
}

function PaymentStatusBadge({
  label,
  status,
}: {
  label: string;
  status: PaymentStatus;
}) {
  const styles =
    status === "VERIFIED"
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : status === "REJECTED" || status === "EXPIRED"
        ? "border-red-200 bg-red-50 text-red-800"
        : status === "REFUNDED"
          ? "border-violet-200 bg-violet-50 text-violet-800"
          : "border-blue-200 bg-blue-50 text-blue-800";
  return (
    <span
      className={`inline-flex rounded-md border px-2.5 py-1 text-xs font-semibold ${styles}`}
    >
      {label}
    </span>
  );
}
