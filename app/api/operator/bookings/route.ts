import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  bookingDeletionEligibility,
  reconcileLifecycle,
  reconcileLifecycleInTransaction,
} from "@/lib/lifecycle";
import { isDateOnly, readJsonObject } from "@/lib/validation";

const PAGE_SIZE = 10;
const BOOKING_VIEWS = [
  "active",
  "confirmed",
  "expired",
  "cancelled",
  "completed",
  "history",
] as const;
type BookingView = (typeof BOOKING_VIEWS)[number];

function viewWhere(view: BookingView): Prisma.BookingWhereInput {
  switch (view) {
    case "confirmed":
      return { status: "CONFIRMED", trip: { status: "SCHEDULED" } };
    case "expired":
      return { status: "EXPIRED" };
    case "cancelled":
      return {
        OR: [{ status: "CANCELLED" }, { trip: { status: "CANCELLED" } }],
      };
    case "completed":
      return { trip: { status: "COMPLETED" } };
    case "history":
      return {
        OR: [
          { status: { in: ["EXPIRED", "CANCELLED"] } },
          { trip: { status: { in: ["COMPLETED", "CANCELLED", "ARCHIVED"] } } },
        ],
      };
    default:
      return {
        status: { in: ["PENDING", "CONFIRMED"] },
        trip: { status: "SCHEDULED" },
      };
  }
}

export async function GET(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  await reconcileLifecycle({ operatorId: authorization.user.id });

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().slice(0, 120) ?? "";
  const rawView = searchParams.get("view")?.trim().toLowerCase() ?? "active";
  const view = BOOKING_VIEWS.includes(rawView as BookingView)
    ? (rawView as BookingView)
    : "active";
  const date = searchParams.get("date")?.trim() ?? "";
  const sort = searchParams.get("sort") === "oldest" ? "oldest" : "newest";
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );

  if (date && !isDateOnly(date)) {
    return NextResponse.json({ error: "SEARCH_INVALID_DATE" }, { status: 400 });
  }

  const tripFilter: Prisma.TripWhereInput = {
    operatorId: authorization.user.id,
  };
  if (date) {
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T00:00:00.000Z`);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    tripFilter.date = { gte: dayStart, lt: dayEnd };
  }

  const searchWhere: Prisma.BookingWhereInput = query
    ? {
        OR: [
          { id: { contains: query, mode: "insensitive" } },
          { fullName: { contains: query, mode: "insensitive" } },
          { phone: { contains: query, mode: "insensitive" } },
          { email: { contains: query, mode: "insensitive" } },
          {
            passenger: {
              is: {
                OR: [
                  { fullName: { contains: query, mode: "insensitive" } },
                  { email: { contains: query, mode: "insensitive" } },
                  { phone: { contains: query, mode: "insensitive" } },
                ],
              },
            },
          },
          {
            trip: {
              is: {
                route: {
                  is: {
                    OR: [
                      { origin: { contains: query, mode: "insensitive" } },
                      { destination: { contains: query, mode: "insensitive" } },
                      { originEn: { contains: query, mode: "insensitive" } },
                      { originAm: { contains: query, mode: "insensitive" } },
                      { destinationEn: { contains: query, mode: "insensitive" } },
                      { destinationAm: { contains: query, mode: "insensitive" } },
                    ],
                  },
                },
              },
            },
          },
          {
            trip: {
              is: {
                bus: {
                  is: { plateNumber: { contains: query, mode: "insensitive" } },
                },
              },
            },
          },
        ],
      }
    : {};

  const where: Prisma.BookingWhereInput = {
    AND: [{ trip: tripFilter }, viewWhere(view), searchWhere],
  };

  const [bookings, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      select: {
        id: true,
        seatNumber: true,
        status: true,
        fullName: true,
        phone: true,
        email: true,
        holdExpiresAt: true,
        expiredAt: true,
        createdAt: true,
        payments: { select: { status: true } },
        trip: {
          select: {
            date: true,
            departureTime: true,
            arrivalTime: true,
            status: true,
            route: {
              select: {
                origin: true,
                destination: true,
                originEn: true,
                originAm: true,
                destinationEn: true,
                destinationAm: true,
              },
            },
            bus: { select: { plateNumber: true } },
          },
        },
      },
      orderBy: [
        { createdAt: sort === "oldest" ? "asc" : "desc" },
        { id: sort === "oldest" ? "asc" : "desc" },
      ],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.booking.count({ where }),
  ]);

  return NextResponse.json({
    bookings: bookings.map(({ payments, ...booking }) => ({
      ...booking,
      deletion: bookingDeletionEligibility({ status: booking.status, payments }),
      hasPaymentHistory: payments.length > 0,
      refundRequired: payments.some((payment) => payment.status === "VERIFIED"),
    })),
    total,
    page,
    hasMore: page * PAGE_SIZE < total,
  });
}

export async function DELETE(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  if (body?.action !== "clear-eligible-expired") {
    return NextResponse.json({ error: "INVALID_BOOKING_ACTION" }, { status: 400 });
  }

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await reconcileLifecycleInTransaction(tx, {
          operatorId: authorization.user.id,
          deleteExpired: false,
        });
        const deleted = await tx.booking.deleteMany({
          where: {
            status: "EXPIRED",
            payments: { none: {} },
            trip: { operatorId: authorization.user.id },
          },
        });
        return { deleted: deleted.count };
      },
      { maxWait: 5_000, timeout: 20_000 },
    );
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "BOOKING_DELETE_UNSAFE" },
        { status: 409 },
      );
    }
    throw error;
  }
}
