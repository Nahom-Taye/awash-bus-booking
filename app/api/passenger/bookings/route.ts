import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { reconcileLifecycle } from "@/lib/lifecycle";

export async function GET(request: Request) {
  const authorization = await requireRole("PASSENGER");
  if (authorization.response) return authorization.response;
  await reconcileLifecycle({
    passengerId: authorization.user.id,
  });

  const view = new URL(request.url).searchParams.get("view") ?? "active";
  const lifecycleWhere: Prisma.BookingWhereInput =
    view === "all"
      ? {}
      : view === "history"
        ? {
            OR: [
              { status: { in: ["EXPIRED", "CANCELLED"] } },
              {
                trip: {
                  status: {
                    in: ["COMPLETED", "CANCELLED", "ARCHIVED"],
                  },
                },
              },
            ],
          }
        : {
            status: { in: ["PENDING", "CONFIRMED"] },
            trip: { status: "SCHEDULED" },
          };

  const bookings = await prisma.booking.findMany({
    where: {
      passengerId: authorization.user.id,
      ...lifecycleWhere,
    },
    select: {
      id: true,
      seatNumber: true,
      fullName: true,
      phone: true,
      email: true,
      status: true,
      holdExpiresAt: true,
      expiredAt: true,
      createdAt: true,
      payments: {
        select: {
          id: true,
          method: true,
          amount: true,
          currency: true,
          transactionReference: true,
          status: true,
          rejectionReason: true,
          verifiedAt: true,
          createdAt: true,
        },
        orderBy: { createdAt: "desc" },
      },
      trip: {
        select: {
          id: true,
          date: true,
          departureTime: true,
          arrivalTime: true,
          price: true,
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
          bus: {
            select: {
              plateNumber: true,
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(bookings, { status: 200 });
}
