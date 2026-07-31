"use client";

import { useEffect, useId, type ReactNode } from "react";

export type ToastMessage = {
  type: "success" | "error";
  text: string;
};

export function OperatorToast({
  toast,
  closeLabel,
  onDismiss,
}: {
  toast: ToastMessage | null;
  closeLabel: string;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(onDismiss, 5_000);
    return () => window.clearTimeout(timeout);
  }, [onDismiss, toast]);

  if (!toast) return null;

  return (
    <div
      role={toast.type === "error" ? "alert" : "status"}
      className={`fixed right-4 top-4 z-[70] flex max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-xl ${
        toast.type === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-red-200 bg-red-50 text-red-900"
      }`}
    >
      <span className="leading-6">{toast.text}</span>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={closeLabel}
        className="rounded px-1 font-bold focus:outline-none focus-visible:ring-2 focus-visible:ring-current"
      >
        ×
      </button>
    </div>
  );
}

export function IconActionButton({
  icon,
  label,
  onClick,
  disabled = false,
  loading = false,
  showText = false,
  destructive = false,
}: {
  icon: "trash" | "eye";
  label: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  showText?: boolean;
  destructive?: boolean;
}) {
  const tooltipId = useId();
  const iconElement =
    icon === "trash" ? (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M3 6h18" />
        <path d="M8 6V4h8v2" />
        <path d="M19 6l-1 14H6L5 6" />
        <path d="M10 11v5M14 11v5" />
      </svg>
    ) : (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="h-4 w-4"
        aria-hidden="true"
      >
        <path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </svg>
    );

  return (
    <span className="group relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        disabled={disabled || loading}
        aria-label={label}
        aria-describedby={tooltipId}
        title={label}
        className={`inline-flex min-h-10 min-w-10 items-center justify-center gap-2 rounded-lg border px-2.5 text-sm font-semibold transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          destructive
            ? "border-red-200 bg-white text-red-700 hover:bg-red-50"
            : "border-stone-300 bg-white text-stone-700 hover:bg-stone-50"
        }`}
      >
        {loading ? <span aria-hidden="true">…</span> : iconElement}
        {showText && <span className="hidden sm:inline">{label}</span>}
      </button>
      <span
        id={tooltipId}
        role="tooltip"
        className="pointer-events-none absolute bottom-full right-0 z-20 mb-2 hidden w-max max-w-52 rounded-md bg-stone-950 px-2.5 py-1.5 text-xs font-medium text-white shadow-lg group-hover:block group-focus-within:block"
      >
        {label}
      </span>
    </span>
  );
}

export function InlineDetail({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-stone-500">{label}</dt>
      <dd className="mt-1 break-words text-sm font-medium text-stone-900">
        {children}
      </dd>
    </div>
  );
}
