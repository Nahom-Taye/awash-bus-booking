"use client";

import Image from "next/image";
import {
  useCallback,
  useEffect,
  useId,
  useState,
  type ReactNode,
} from "react";
import { useTranslations } from "next-intl";
import {
  OperatorToast,
  type ToastMessage,
} from "@/app/components/operator/OperatorFeedback";
import { readApiErrorCode } from "@/lib/api-client";

type PaymentSettings = {
  telebirrEnabled: boolean;
  telebirrRecipientName: string;
  telebirrMerchantNumber: string;
  cbeEnabled: boolean;
  cbeAccountHolderName: string;
  cbeAccountNumber: string;
  hasSavedSettings: boolean;
};

type SettingsField =
  | "telebirrRecipientName"
  | "telebirrMerchantNumber"
  | "cbeAccountHolderName"
  | "cbeAccountNumber";
type FieldErrorCode = "REQUIRED" | "TOO_SHORT" | "TOO_LONG";
type FieldErrors = Partial<Record<SettingsField, FieldErrorCode>>;

const EMPTY_SETTINGS: PaymentSettings = {
  telebirrEnabled: false,
  telebirrRecipientName: "",
  telebirrMerchantNumber: "",
  cbeEnabled: false,
  cbeAccountHolderName: "",
  cbeAccountNumber: "",
  hasSavedSettings: false,
};

export default function OperatorPaymentSettingsTab() {
  const t = useTranslations("operator.paymentSettings");
  const tCommon = useTranslations("common");
  const tErrors = useTranslations("errors");
  const [settings, setSettings] =
    useState<PaymentSettings>(EMPTY_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [savingMethod, setSavingMethod] = useState<
    "TELEBIRR" | "CBE" | null
  >(null);
  const [savedMethod, setSavedMethod] = useState<
    "TELEBIRR" | "CBE" | null
  >(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await fetch("/api/operator/payment-settings", {
        cache: "no-store",
      });
      if (!response.ok) {
        const code = await readApiErrorCode(response);
        throw new Error(
          tErrors.has(code)
            ? tErrors(code)
            : tErrors("LOAD_PAYMENT_SETTINGS_FAILED"),
        );
      }
      setSettings((await response.json()) as PaymentSettings);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : tErrors("LOAD_PAYMENT_SETTINGS_FAILED"),
      );
    } finally {
      setLoading(false);
    }
  }, [tErrors]);

  useEffect(() => {
    queueMicrotask(() => void loadSettings());
  }, [loadSettings]);

  function fieldError(
    value: string,
    required: boolean,
    minLength: number,
    maxLength: number,
  ): FieldErrorCode | null {
    const trimmed = value.trim();
    if (!trimmed) return required ? "REQUIRED" : null;
    if (trimmed.length < minLength) return "TOO_SHORT";
    if (trimmed.length > maxLength) return "TOO_LONG";
    return null;
  }

  function validateMethod(
    method: "TELEBIRR" | "CBE",
    enabled: boolean,
  ): FieldErrors {
    const next: FieldErrors = {};
    if (method === "TELEBIRR") {
      const recipientError = fieldError(
        settings.telebirrRecipientName,
        enabled,
        2,
        120,
      );
      const merchantError = fieldError(
        settings.telebirrMerchantNumber,
        enabled,
        3,
        80,
      );
      if (recipientError) {
        next.telebirrRecipientName = recipientError;
      }
      if (merchantError) {
        next.telebirrMerchantNumber = merchantError;
      }
    } else {
      const holderError = fieldError(
        settings.cbeAccountHolderName,
        enabled,
        2,
        120,
      );
      const accountError = fieldError(
        settings.cbeAccountNumber,
        enabled,
        3,
        80,
      );
      if (holderError) next.cbeAccountHolderName = holderError;
      if (accountError) next.cbeAccountNumber = accountError;
    }
    return next;
  }

  function changeSetting<Key extends keyof PaymentSettings>(
    key: Key,
    value: PaymentSettings[Key],
  ) {
    setSettings((current) => ({ ...current, [key]: value }));
    setSavedMethod(null);
    if (key in fieldErrors) {
      setFieldErrors((current) => {
        const next = { ...current };
        delete next[key as SettingsField];
        return next;
      });
    }
  }

  function toggleMethod(method: "TELEBIRR" | "CBE", enabled: boolean) {
    if (enabled) {
      const errors = validateMethod(method, true);
      if (Object.keys(errors).length > 0) {
        setFieldErrors((current) => ({ ...current, ...errors }));
        setToast({ type: "error", text: t("completeBeforeEnable") });
        return;
      }
    }
    changeSetting(
      method === "TELEBIRR" ? "telebirrEnabled" : "cbeEnabled",
      enabled,
    );
  }

  async function saveMethod(method: "TELEBIRR" | "CBE") {
    const enabled =
      method === "TELEBIRR"
        ? settings.telebirrEnabled
        : settings.cbeEnabled;
    const errors = validateMethod(method, enabled);
    if (Object.keys(errors).length > 0) {
      setFieldErrors((current) => ({ ...current, ...errors }));
      setToast({ type: "error", text: t("correctFields") });
      return;
    }

    setSavingMethod(method);
    setSavedMethod(null);
    setToast(null);
    try {
      const response = await fetch("/api/operator/payment-settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          method === "TELEBIRR"
            ? {
                method,
                enabled,
                telebirrRecipientName:
                  settings.telebirrRecipientName,
                telebirrMerchantNumber:
                  settings.telebirrMerchantNumber,
              }
            : {
                method,
                enabled,
                cbeAccountHolderName:
                  settings.cbeAccountHolderName,
                cbeAccountNumber: settings.cbeAccountNumber,
              },
        ),
      });
      const payload = (await response.json().catch(() => ({}))) as
        | (PaymentSettings & { fieldErrors?: FieldErrors })
        | { error?: string; fieldErrors?: FieldErrors };
      if (!response.ok) {
        if (payload.fieldErrors) {
          setFieldErrors((current) => ({
            ...current,
            ...payload.fieldErrors,
          }));
        }
        const code =
          "error" in payload && typeof payload.error === "string"
            ? payload.error
            : "UPDATE_PAYMENT_SETTINGS_FAILED";
        throw new Error(
          tErrors.has(code)
            ? tErrors(code)
            : tErrors("UPDATE_PAYMENT_SETTINGS_FAILED"),
        );
      }

      setSettings(payload as PaymentSettings);
      setFieldErrors({});
      setSavedMethod(method);
      setToast({ type: "success", text: t("saved") });
    } catch (error) {
      setToast({
        type: "error",
        text:
          error instanceof Error
            ? error.message
            : tErrors("UPDATE_PAYMENT_SETTINGS_FAILED"),
      });
    } finally {
      setSavingMethod(null);
    }
  }

  function errorMessage(
    field: SettingsField,
    minLength: number,
    maxLength: number,
  ) {
    const code = fieldErrors[field];
    if (!code) return null;
    if (code === "REQUIRED") return t("required");
    if (code === "TOO_SHORT") {
      return t("minimumCharacters", { count: minLength });
    }
    return t("maximumCharacters", { count: maxLength });
  }

  if (loading) {
    return (
      <div aria-busy="true" className="space-y-5">
        <div className="h-24 animate-pulse rounded-xl bg-stone-200" />
        <div className="grid gap-5 xl:grid-cols-2">
          <div className="h-96 animate-pulse rounded-xl bg-stone-200" />
          <div className="h-96 animate-pulse rounded-xl bg-stone-200" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="awash-alert-error">
        <p>{loadError}</p>
        <button
          type="button"
          onClick={() => void loadSettings()}
          className="mt-2 font-semibold underline"
        >
          {tCommon("retry")}
        </button>
      </div>
    );
  }

  return (
    <section>
      <p className="awash-section-label">{t("eyebrow")}</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight sm:text-3xl">
        {t("title")}
      </h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-600">
        {t("description")}
      </p>
      <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        {t("manualNotice")}
      </p>

      <div className="mt-6 grid items-start gap-5 xl:grid-cols-2">
        <PaymentSettingsSection
          title="Telebirr"
          description={t("telebirrDescription")}
          logo={
            <Image
              src="/images/payments/telebirr.png"
              alt="Telebirr"
              width={174}
              height={80}
              className="h-16 w-auto object-contain"
            />
          }
          toggleLabel={t("enableTelebirr")}
          enabled={settings.telebirrEnabled}
          disabled={Boolean(savingMethod)}
          onToggle={(enabled) => toggleMethod("TELEBIRR", enabled)}
          fields={
            <>
              <SettingsInput
                label={t("telebirrRecipientName")}
                value={settings.telebirrRecipientName}
                error={errorMessage(
                  "telebirrRecipientName",
                  2,
                  120,
                )}
                disabled={Boolean(savingMethod)}
                maxLength={120}
                onChange={(value) =>
                  changeSetting("telebirrRecipientName", value)
                }
              />
              <SettingsInput
                label={t("telebirrMerchantNumber")}
                value={settings.telebirrMerchantNumber}
                error={errorMessage(
                  "telebirrMerchantNumber",
                  3,
                  80,
                )}
                disabled={Boolean(savingMethod)}
                maxLength={80}
                onChange={(value) =>
                  changeSetting("telebirrMerchantNumber", value)
                }
              />
            </>
          }
          saveLabel={
            savingMethod === "TELEBIRR"
              ? t("saving")
              : t("saveTelebirr")
          }
          savedMessage={
            savedMethod === "TELEBIRR" ? t("telebirrSaved") : null
          }
          onSave={() => void saveMethod("TELEBIRR")}
        />

        <PaymentSettingsSection
          title={t("cbeName")}
          description={t("cbeDescription")}
          logo={
            <Image
              src="/images/payments/cbe-logo.jpg"
              alt="Commercial Bank of Ethiopia"
              width={151}
              height={148}
              className="h-16 w-auto object-contain"
            />
          }
          toggleLabel={t("enableCbe")}
          enabled={settings.cbeEnabled}
          disabled={Boolean(savingMethod)}
          onToggle={(enabled) => toggleMethod("CBE", enabled)}
          fields={
            <>
              <SettingsInput
                label={t("cbeAccountHolderName")}
                value={settings.cbeAccountHolderName}
                error={errorMessage(
                  "cbeAccountHolderName",
                  2,
                  120,
                )}
                disabled={Boolean(savingMethod)}
                maxLength={120}
                onChange={(value) =>
                  changeSetting("cbeAccountHolderName", value)
                }
              />
              <SettingsInput
                label={t("cbeAccountNumber")}
                value={settings.cbeAccountNumber}
                error={errorMessage("cbeAccountNumber", 3, 80)}
                disabled={Boolean(savingMethod)}
                maxLength={80}
                onChange={(value) =>
                  changeSetting("cbeAccountNumber", value)
                }
              />
            </>
          }
          saveLabel={
            savingMethod === "CBE" ? t("saving") : t("saveCbe")
          }
          savedMessage={savedMethod === "CBE" ? t("cbeSaved") : null}
          onSave={() => void saveMethod("CBE")}
        />
      </div>

      <OperatorToast
        toast={toast}
        closeLabel={tCommon("close")}
        onDismiss={() => setToast(null)}
      />
    </section>
  );
}

function PaymentSettingsSection({
  title,
  description,
  logo,
  toggleLabel,
  enabled,
  disabled,
  onToggle,
  fields,
  saveLabel,
  savedMessage,
  onSave,
}: {
  title: string;
  description: string;
  logo: ReactNode;
  toggleLabel: string;
  enabled: boolean;
  disabled: boolean;
  onToggle: (enabled: boolean) => void;
  fields: ReactNode;
  saveLabel: string;
  savedMessage: string | null;
  onSave: () => void;
}) {
  const toggleLabelId = useId();

  return (
    <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex min-h-20 items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            {description}
          </p>
        </div>
        <div className="shrink-0">{logo}</div>
      </div>

      <div className="mt-5 border-y border-stone-200 py-4">
        <div className="flex items-center justify-between gap-4">
          <span
            id={toggleLabelId}
            className="text-sm font-bold text-stone-900"
          >
            {toggleLabel}
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            aria-labelledby={toggleLabelId}
            disabled={disabled}
            onClick={() => onToggle(!enabled)}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-awash-orange focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              enabled ? "bg-awash-orange" : "bg-stone-300"
            }`}
          >
            <span
              aria-hidden="true"
              className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${
                enabled ? "left-6" : "left-1"
              }`}
            />
          </button>
        </div>
      </div>

      <div className="mt-5 space-y-4">{fields}</div>
      {savedMessage && (
        <p
          className="mt-4 text-sm font-semibold text-emerald-700"
          role="status"
        >
          {savedMessage}
        </p>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={onSave}
        className="awash-primary mt-5 w-full"
      >
        {saveLabel}
      </button>
    </section>
  );
}

function SettingsInput({
  label,
  value,
  error,
  disabled,
  maxLength,
  onChange,
}: {
  label: string;
  value: string;
  error: string | null;
  disabled: boolean;
  maxLength: number;
  onChange: (value: string) => void;
}) {
  return (
    <label className="awash-label">
      {label}
      <input
        value={value}
        maxLength={maxLength}
        disabled={disabled}
        aria-invalid={Boolean(error)}
        onChange={(event) => onChange(event.target.value)}
        className={`awash-input ${
          error ? "border-red-400 focus:border-red-500" : ""
        }`}
      />
      {error && (
        <span className="text-xs font-medium text-red-700">{error}</span>
      )}
    </label>
  );
}
