import { NextResponse } from "next/server";
import type {
  PaymentMethod,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";

const PAGE_SIZE = 10;
const PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "VERIFIED",
  "REJECTED",
  "EXPIRED",
  "REFUNDED",
];
const PAYMENT_METHODS: PaymentMethod[] = ["TELEBIRR", "CBE"];

export async function GET(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q")?.trim().slice(0, 120) ?? "";
  const rawStatus = searchParams.get("status")?.trim().toUpperCase() ?? "";
  const status = PAYMENT_STATUSES.includes(rawStatus as PaymentStatus)
    ? (rawStatus as PaymentStatus)
    : null;
  const rawMethod = searchParams.get("method")?.trim().toUpperCase() ?? "";
  const method = PAYMENT_METHODS.includes(rawMethod as PaymentMethod)
    ? (rawMethod as PaymentMethod)
    : null;
  const page = Math.max(
    1,
    Number.parseInt(searchParams.get("page") ?? "1", 10) || 1,
  );

  const where: Prisma.PaymentWhereInput = {
    booking: { trip: { operatorId: authorization.user.id } },
    ...(status ? { status } : {}),
    ...(method ? { method } : {}),
    ...(query
      ? {
          OR: [
            {
              transactionReference: {
                contains: query,
                mode: "insensitive",
              },
            },
            { senderName: { contains: query, mode: "insensitive" } },
            {
              senderIdentifier: {
                contains: query,
                mode: "insensitive",
              },
            },
            { booking: { is: { id: { contains: query } } } },
            {
              booking: {
                is: { fullName: { contains: query, mode: "insensitive" } },
              },
            },
            {
              booking: {
                is: { phone: { contains: query, mode: "insensitive" } },
              },
            },
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
              booking: {
                is: {
                  trip: {
                    is: {
                      route: {
                        is: {
                          OR: [
                            {
                              origin: {
                                contains: query,
                                mode: "insensitive",
                              },
                            },
                            {
                              destination: {
                                contains: query,
                                mode: "insensitive",
                              },
                            },
                            {
                              originEn: {
                                contains: query,
                                mode: "insensitive",
                              },
                            },
                            {
                              originAm: {
                                contains: query,
                                mode: "insensitive",
                              },
                            },
                            {
                              destinationEn: {
                                contains: query,
                                mode: "insensitive",
                              },
                            },
                            {
                              destinationAm: {
                                contains: query,
                                mode: "insensitive",
                              },
                            },
                          ],
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        }
      : {}),
  };

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true,
        method: true,
        amount: true,
        currency: true,
        transactionReference: true,
        senderName: true,
        senderIdentifier: true,
        status: true,
        rejectionReason: true,
        verifiedAt: true,
        createdAt: true,
        updatedAt: true,
        passenger: {
          select: {
            fullName: true,
            email: true,
            phone: true,
          },
        },
        booking: {
          select: {
            id: true,
            seatNumber: true,
            fullName: true,
            phone: true,
            email: true,
            status: true,
            trip: {
              select: {
                id: true,
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
                bus: {
                  select: {
                    plateNumber: true,
                  },
                },
              },
            },
          },
        },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({
    payments,
    total,
    page,
    hasMore: page * PAGE_SIZE < total,
  });
}
