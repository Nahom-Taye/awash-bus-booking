BEGIN;

CREATE TABLE "OperatorPaymentSettings" (
  "id" TEXT NOT NULL,
  "operatorId" TEXT NOT NULL,
  "telebirrEnabled" BOOLEAN NOT NULL DEFAULT false,
  "telebirrRecipientName" TEXT,
  "telebirrMerchantNumber" TEXT,
  "cbeEnabled" BOOLEAN NOT NULL DEFAULT false,
  "cbeAccountHolderName" TEXT,
  "cbeAccountNumber" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "OperatorPaymentSettings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperatorPaymentSettings_operatorId_fkey"
    FOREIGN KEY ("operatorId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "OperatorPaymentSettings_operatorId_key"
  ON "OperatorPaymentSettings"("operatorId");

COMMIT;
