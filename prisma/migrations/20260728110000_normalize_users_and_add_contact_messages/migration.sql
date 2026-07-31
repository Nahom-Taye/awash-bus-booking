UPDATE "User"
SET "email" = LOWER(BTRIM("email"))
WHERE "email" <> LOWER(BTRIM("email"));

CREATE UNIQUE INDEX "User_email_normalized_key"
ON "User" (LOWER(BTRIM("email")));

ALTER TABLE "User"
ADD CONSTRAINT "User_email_normalized_check"
CHECK ("email" = LOWER(BTRIM("email")));

ALTER TABLE "Booking"
ADD COLUMN "email" TEXT;

CREATE TABLE "ContactMessage" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ContactMessage_pkey" PRIMARY KEY ("id")
);
