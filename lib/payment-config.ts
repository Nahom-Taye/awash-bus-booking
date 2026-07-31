import "server-only";

import type { OperatorPaymentSettings } from "@prisma/client";
import prisma from "@/lib/prisma";

export type CheckoutPaymentConfiguration = {
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

export type ManagedOperatorPaymentSettings = {
  telebirrEnabled: boolean;
  telebirrRecipientName: string;
  telebirrMerchantNumber: string;
  cbeEnabled: boolean;
  cbeAccountHolderName: string;
  cbeAccountNumber: string;
  hasSavedSettings: boolean;
};

export type StoredOperatorPaymentSettings = Pick<
  OperatorPaymentSettings,
  | "telebirrEnabled"
  | "telebirrRecipientName"
  | "telebirrMerchantNumber"
  | "cbeEnabled"
  | "cbeAccountHolderName"
  | "cbeAccountNumber"
>;

const PAYMENT_ENVIRONMENT_VARIABLES = {
  telebirrRecipientName: "AWASH_PAYMENT_RECIPIENT_NAME",
  telebirrMerchantNumber: "AWASH_TELEBIRR_MERCHANT_NUMBER",
  cbeAccountHolderName: "AWASH_CBE_ACCOUNT_HOLDER_NAME",
  cbeAccountNumber: "AWASH_CBE_ACCOUNT_NUMBER",
} as const;

function configuredValue(name: string): string | null {
  const value = process.env[name]?.trim();
  return value ? value : null;
}

function legacyEnvironmentSettings(): StoredOperatorPaymentSettings {
  const telebirrRecipientName = configuredValue(
    PAYMENT_ENVIRONMENT_VARIABLES.telebirrRecipientName,
  );
  const telebirrMerchantNumber = configuredValue(
    PAYMENT_ENVIRONMENT_VARIABLES.telebirrMerchantNumber,
  );
  const cbeAccountHolderName = configuredValue(
    PAYMENT_ENVIRONMENT_VARIABLES.cbeAccountHolderName,
  );
  const cbeAccountNumber = configuredValue(
    PAYMENT_ENVIRONMENT_VARIABLES.cbeAccountNumber,
  );

  return {
    telebirrEnabled: Boolean(
      telebirrRecipientName && telebirrMerchantNumber,
    ),
    telebirrRecipientName,
    telebirrMerchantNumber,
    cbeEnabled: Boolean(cbeAccountHolderName && cbeAccountNumber),
    cbeAccountHolderName,
    cbeAccountNumber,
  };
}

export function resolveOperatorPaymentConfiguration(
  storedSettings: StoredOperatorPaymentSettings | null,
): CheckoutPaymentConfiguration {
  const settings = storedSettings ?? legacyEnvironmentSettings();
  const telebirrAvailable = Boolean(
    settings.telebirrEnabled &&
      settings.telebirrRecipientName?.trim() &&
      settings.telebirrMerchantNumber?.trim(),
  );
  const cbeAvailable = Boolean(
    settings.cbeEnabled &&
      settings.cbeAccountHolderName?.trim() &&
      settings.cbeAccountNumber?.trim(),
  );

  return {
    telebirr: {
      available: telebirrAvailable,
      recipientName: telebirrAvailable
        ? settings.telebirrRecipientName
        : null,
      merchantNumber: telebirrAvailable
        ? settings.telebirrMerchantNumber
        : null,
    },
    cbe: {
      available: cbeAvailable,
      accountHolderName: cbeAvailable
        ? settings.cbeAccountHolderName
        : null,
      accountNumber: cbeAvailable ? settings.cbeAccountNumber : null,
    },
  };
}

export async function getOperatorCheckoutPaymentConfiguration(
  operatorId: string,
): Promise<CheckoutPaymentConfiguration> {
  const storedSettings = await prisma.operatorPaymentSettings.findUnique({
    where: { operatorId },
    select: {
      telebirrEnabled: true,
      telebirrRecipientName: true,
      telebirrMerchantNumber: true,
      cbeEnabled: true,
      cbeAccountHolderName: true,
      cbeAccountNumber: true,
    },
  });

  return resolveOperatorPaymentConfiguration(storedSettings);
}

export async function getManagedOperatorPaymentSettings(
  operatorId: string,
): Promise<ManagedOperatorPaymentSettings> {
  const storedSettings = await prisma.operatorPaymentSettings.findUnique({
    where: { operatorId },
    select: {
      telebirrEnabled: true,
      telebirrRecipientName: true,
      telebirrMerchantNumber: true,
      cbeEnabled: true,
      cbeAccountHolderName: true,
      cbeAccountNumber: true,
    },
  });
  const settings = storedSettings ?? legacyEnvironmentSettings();

  return {
    telebirrEnabled: settings.telebirrEnabled,
    telebirrRecipientName: settings.telebirrRecipientName ?? "",
    telebirrMerchantNumber: settings.telebirrMerchantNumber ?? "",
    cbeEnabled: settings.cbeEnabled,
    cbeAccountHolderName: settings.cbeAccountHolderName ?? "",
    cbeAccountNumber: settings.cbeAccountNumber ?? "",
    hasSavedSettings: Boolean(storedSettings),
  };
}
