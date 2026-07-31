import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient({
  datasources: {
    db: {
      url:
        process.env.TEST_DATABASE_URL ??
        process.env.DATABASE_URL ??
        process.env.DIRECT_URL,
    },
  },
});

async function main() {
  const [
    users,
    routes,
    buses,
    trips,
    bookings,
    payments,
    paymentSettings,
    roles,
    normalizedEmailConflicts,
    routeOwnershipConflicts,
    busOwnershipConflicts,
    tripOwnershipConflicts,
    bookingOwnershipConflicts,
    paymentPassengerConflicts,
    paymentVerifierConflicts,
    paymentAmountConflicts,
    paymentSettingsOwnershipConflicts,
    paymentSettingsConfigurationConflicts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.route.count(),
    prisma.bus.count(),
    prisma.trip.count(),
    prisma.booking.count(),
    prisma.payment.count(),
    prisma.operatorPaymentSettings.count(),
    prisma.user.groupBy({ by: ["role"], _count: { _all: true } }),
    prisma.$queryRaw`
      SELECT LOWER(BTRIM("email")) AS "normalizedEmail", COUNT(*)::int AS "count",
             ARRAY_AGG("id" ORDER BY "id") AS "userIds",
             ARRAY_AGG("email" ORDER BY "id") AS "emails"
      FROM "User"
      GROUP BY LOWER(BTRIM("email"))
      HAVING COUNT(*) > 1
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Route" r
      JOIN "User" u ON u."id" = r."operatorId"
      WHERE u."role" <> 'OPERATOR'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Bus" b
      JOIN "User" u ON u."id" = b."operatorId"
      WHERE u."role" <> 'OPERATOR'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Trip" t
      JOIN "User" u ON u."id" = t."operatorId"
      WHERE u."role" <> 'OPERATOR'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Booking" b
      JOIN "User" u ON u."id" = b."passengerId"
      WHERE u."role" <> 'PASSENGER'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Payment" p
      JOIN "User" u ON u."id" = p."passengerId"
      WHERE u."role" <> 'PASSENGER'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Payment" p
      JOIN "Booking" b ON b."id" = p."bookingId"
      JOIN "Trip" t ON t."id" = b."tripId"
      WHERE p."verifiedById" IS NOT NULL
        AND p."verifiedById" <> t."operatorId"
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "Payment" p
      JOIN "Booking" b ON b."id" = p."bookingId"
      JOIN "Trip" t ON t."id" = b."tripId"
      WHERE p."currency" <> 'ETB' OR p."amount" <> t."price"
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "OperatorPaymentSettings" s
      JOIN "User" u ON u."id" = s."operatorId"
      WHERE u."role" <> 'OPERATOR'
    `,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM "OperatorPaymentSettings" s
      WHERE (
          s."telebirrEnabled" = TRUE
          AND (
            NULLIF(BTRIM(s."telebirrRecipientName"), '') IS NULL
            OR NULLIF(BTRIM(s."telebirrMerchantNumber"), '') IS NULL
          )
        )
        OR (
          s."cbeEnabled" = TRUE
          AND (
            NULLIF(BTRIM(s."cbeAccountHolderName"), '') IS NULL
            OR NULLIF(BTRIM(s."cbeAccountNumber"), '') IS NULL
          )
        )
    `,
  ]);

  const result = {
    counts: {
      users,
      routes,
      buses,
      trips,
      bookings,
      payments,
      paymentSettings,
    },
    roles: roles.map((entry) => ({
      role: entry.role,
      count: entry._count._all,
    })),
    normalizedEmailConflicts,
    ownershipConflicts: {
      routes: routeOwnershipConflicts[0].count,
      buses: busOwnershipConflicts[0].count,
      trips: tripOwnershipConflicts[0].count,
      bookings: bookingOwnershipConflicts[0].count,
      paymentPassengers: paymentPassengerConflicts[0].count,
      paymentVerifiers: paymentVerifierConflicts[0].count,
      paymentAmounts: paymentAmountConflicts[0].count,
      paymentSettings: paymentSettingsOwnershipConflicts[0].count,
      paymentSettingsConfiguration:
        paymentSettingsConfigurationConflicts[0].count,
    },
  };

  console.log(JSON.stringify(result, null, 2));

  if (
    normalizedEmailConflicts.length > 0 ||
    Object.values(result.ownershipConflicts).some((count) => count > 0)
  ) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
