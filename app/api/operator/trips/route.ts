import { NextResponse } from "next/server";
import type { TripStatus } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  reconcileLifecycle,
  tripDeletionEligibility,
} from "@/lib/lifecycle";
import {
  isDateOnly,
  isTimeOnly,
  readJsonObject,
} from "@/lib/validation";

const TRIP_VIEWS = [
  "active",
  "completed",
  "cancelled",
  "archived",
  "all",
] as const;

export async function GET(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  await reconcileLifecycle({ operatorId: authorization.user.id });
  const rawView = new URL(request.url).searchParams.get("view") ?? "active";
  const view = TRIP_VIEWS.includes(rawView as (typeof TRIP_VIEWS)[number])
    ? (rawView as (typeof TRIP_VIEWS)[number])
    : "active";
  const status: TripStatus | undefined =
    view === "active"
      ? "SCHEDULED"
      : view === "all"
        ? undefined
        : view === "completed"
          ? "COMPLETED"
          : view === "cancelled"
            ? "CANCELLED"
            : "ARCHIVED";

  const trips = await prisma.trip.findMany({
    where: {
      operatorId: authorization.user.id,
      ...(status ? { status } : {}),
    },
    include: {
      route: true,
      bus: true,
      _count: { select: { bookings: true } },
      bookings: {
        select: {
          status: true,
          payments: { select: { status: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(
    trips.map(({ bookings, ...trip }) => ({
      ...trip,
      lifecycle: tripDeletionEligibility(trip.status, bookings),
    })),
    { status: 200 },
  );
}

export async function POST(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  const routeId = typeof body?.routeId === "string" ? body.routeId : "";
  const busId = typeof body?.busId === "string" ? body.busId : "";
  const date = typeof body?.date === "string" ? body.date : "";
  const departureTime =
    typeof body?.departureTime === "string" ? body.departureTime : "";
  const arrivalTime =
    typeof body?.arrivalTime === "string" ? body.arrivalTime : "";
  const price = body?.price;

  if (
    !routeId?.trim() ||
    !busId?.trim() ||
    !date?.trim() ||
    !departureTime?.trim() ||
    !arrivalTime?.trim()
  ) {
    return NextResponse.json(
      {
        error: "TRIP_FIELDS_REQUIRED",
      },
      { status: 400 }
    );
  }

  if (typeof price !== "number" || !Number.isFinite(price) || price <= 0) {
    return NextResponse.json(
      { error: "INVALID_PRICE" },
      { status: 400 }
    );
  }

  if (
    !isDateOnly(date) ||
    !isTimeOnly(departureTime) ||
    !isTimeOnly(arrivalTime)
  ) {
    return NextResponse.json(
      { error: "INVALID_DATE_TIME" },
      { status: 400 },
    );
  }

  const parsedDate = new Date(`${date}T00:00:00.000Z`);
  const parsedDeparture = new Date(`${date}T${departureTime}:00.000Z`);
  const parsedArrival = new Date(`${date}T${arrivalTime}:00.000Z`);

  if (parsedArrival <= parsedDeparture) {
    return NextResponse.json(
      { error: "ARRIVAL_BEFORE_DEPARTURE" },
      { status: 400 },
    );
  }

  const route = await prisma.route.findUnique({
    where: { id: routeId },
  });

  if (!route || route.operatorId !== authorization.user.id) {
    return NextResponse.json(
      { error: "ROUTE_FORBIDDEN" },
      { status: 403 }
    );
  }
  if (!route.isActive) {
    return NextResponse.json(
      { error: "ROUTE_ARCHIVED" },
      { status: 409 },
    );
  }

  const bus = await prisma.bus.findUnique({
    where: { id: busId },
  });

  if (!bus || bus.operatorId !== authorization.user.id) {
    return NextResponse.json(
      { error: "BUS_FORBIDDEN" },
      { status: 403 }
    );
  }
  if (!bus.isActive) {
    return NextResponse.json(
      { error: "BUS_ARCHIVED" },
      { status: 409 },
    );
  }

  const trip = await prisma.trip.create({
    data: {
      date: parsedDate,
      departureTime: parsedDeparture,
      arrivalTime: parsedArrival,
      price,
      routeId,
      busId,
      operatorId: authorization.user.id,
    },
    include: {
      route: true,
      bus: true,
      _count: { select: { bookings: true } },
    },
  });

  return NextResponse.json(
    {
      ...trip,
      lifecycle: tripDeletionEligibility(trip.status, []),
    },
    { status: 201 },
  );
}
