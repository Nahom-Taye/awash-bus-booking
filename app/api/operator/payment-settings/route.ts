import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  getManagedOperatorPaymentSettings,
  resolveOperatorPaymentConfiguration,
  type ManagedOperatorPaymentSettings,
} from "@/lib/payment-config";
import { readJsonObject } from "@/lib/validation";

const NO_STORE_HEADERS = {
  "Cache-Control": "private, no-store, max-age=0",
};

type PaymentSettingsField =
  | "telebirrRecipientName"
  | "telebirrMerchantNumber"
  | "cbeAccountHolderName"
  | "cbeAccountNumber";
type FieldErrorCode = "REQUIRED" | "TOO_SHORT" | "TOO_LONG";

function readSetting(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function validateField(
  value: string,
  required: boolean,
  minLength: number,
  maxLength: number,
): FieldErrorCode | null {
  if (!value) return required ? "REQUIRED" : null;
  if (value.length < minLength) return "TOO_SHORT";
  if (value.length > maxLength) return "TOO_LONG";
  return null;
}

function responseSettings(settings: ManagedOperatorPaymentSettings) {
  return {
    telebirrEnabled: settings.telebirrEnabled,
    telebirrRecipientName: settings.telebirrRecipientName,
    telebirrMerchantNumber: settings.telebirrMerchantNumber,
    cbeEnabled: settings.cbeEnabled,
    cbeAccountHolderName: settings.cbeAccountHolderName,
    cbeAccountNumber: settings.cbeAccountNumber,
    hasSavedSettings: settings.hasSavedSettings,
  };
}

export async function GET() {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) {
    authorization.response.headers.set(
      "Cache-Control",
      NO_STORE_HEADERS["Cache-Control"],
    );
    return authorization.response;
  }

  const settings = await getManagedOperatorPaymentSettings(
    authorization.user.id,
  );
  return NextResponse.json(responseSettings(settings), {
    headers: NO_STORE_HEADERS,
  });
}

export async function PATCH(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  const method =
    body?.method === "TELEBIRR"
      ? "TELEBIRR"
      : body?.method === "CBE"
        ? "CBE"
        : null;
  const enabled = body?.enabled;

  if (!method || typeof enabled !== "boolean") {
    return NextResponse.json(
      { error: "INVALID_PAYMENT_SETTINGS" },
      { status: 400 },
    );
  }

  const fieldErrors: Partial<
    Record<PaymentSettingsField, FieldErrorCode>
  > = {};
  const current = await getManagedOperatorPaymentSettings(
    authorization.user.id,
  );

  if (method === "TELEBIRR") {
    const telebirrRecipientName = readSetting(
      body?.telebirrRecipientName,
    );
    const telebirrMerchantNumber = readSetting(
      body?.telebirrMerchantNumber,
    );
    const recipientError = validateField(
      telebirrRecipientName,
      enabled,
      2,
      120,
    );
    const merchantError = validateField(
      telebirrMerchantNumber,
      enabled,
      3,
      80,
    );
    if (recipientError) {
      fieldErrors.telebirrRecipientName = recipientError;
    }
    if (merchantError) {
      fieldErrors.telebirrMerchantNumber = merchantError;
    }
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_SETTINGS", fieldErrors },
        { status: 400 },
      );
    }

    await prisma.operatorPaymentSettings.upsert({
      where: { operatorId: authorization.user.id },
      create: {
        operatorId: authorization.user.id,
        telebirrEnabled: enabled,
        telebirrRecipientName: telebirrRecipientName || null,
        telebirrMerchantNumber: telebirrMerchantNumber || null,
        cbeEnabled: current.cbeEnabled,
        cbeAccountHolderName: current.cbeAccountHolderName || null,
        cbeAccountNumber: current.cbeAccountNumber || null,
      },
      update: {
        telebirrEnabled: enabled,
        telebirrRecipientName: telebirrRecipientName || null,
        telebirrMerchantNumber: telebirrMerchantNumber || null,
      },
    });
  } else {
    const cbeAccountHolderName = readSetting(
      body?.cbeAccountHolderName,
    );
    const cbeAccountNumber = readSetting(body?.cbeAccountNumber);
    const holderError = validateField(
      cbeAccountHolderName,
      enabled,
      2,
      120,
    );
    const accountError = validateField(
      cbeAccountNumber,
      enabled,
      3,
      80,
    );
    if (holderError) {
      fieldErrors.cbeAccountHolderName = holderError;
    }
    if (accountError) {
      fieldErrors.cbeAccountNumber = accountError;
    }
    if (Object.keys(fieldErrors).length > 0) {
      return NextResponse.json(
        { error: "INVALID_PAYMENT_SETTINGS", fieldErrors },
        { status: 400 },
      );
    }

    await prisma.operatorPaymentSettings.upsert({
      where: { operatorId: authorization.user.id },
      create: {
        operatorId: authorization.user.id,
        telebirrEnabled: current.telebirrEnabled,
        telebirrRecipientName:
          current.telebirrRecipientName || null,
        telebirrMerchantNumber:
          current.telebirrMerchantNumber || null,
        cbeEnabled: enabled,
        cbeAccountHolderName: cbeAccountHolderName || null,
        cbeAccountNumber: cbeAccountNumber || null,
      },
      update: {
        cbeEnabled: enabled,
        cbeAccountHolderName: cbeAccountHolderName || null,
        cbeAccountNumber: cbeAccountNumber || null,
      },
    });
  }

  const updated = await getManagedOperatorPaymentSettings(
    authorization.user.id,
  );
  const effectiveConfiguration = resolveOperatorPaymentConfiguration({
    telebirrEnabled: updated.telebirrEnabled,
    telebirrRecipientName: updated.telebirrRecipientName || null,
    telebirrMerchantNumber: updated.telebirrMerchantNumber || null,
    cbeEnabled: updated.cbeEnabled,
    cbeAccountHolderName: updated.cbeAccountHolderName || null,
    cbeAccountNumber: updated.cbeAccountNumber || null,
  });
  if (
    !effectiveConfiguration.telebirr.available &&
    !effectiveConfiguration.cbe.available
  ) {
    await prisma.booking.updateMany({
      where: {
        status: "PENDING",
        holdExpiresAt: { not: null },
        trip: { operatorId: authorization.user.id },
        payments: {
          none: { status: { in: ["PENDING", "VERIFIED"] } },
        },
      },
      data: {
        status: "EXPIRED",
        seatKey: null,
        holdExpiresAt: null,
        expiredAt: new Date(),
      },
    });
  }
  return NextResponse.json(responseSettings(updated), {
    headers: NO_STORE_HEADERS,
  });
}
