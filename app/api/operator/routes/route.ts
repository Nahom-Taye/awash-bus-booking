import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  cityByValue,
  normalizeCityValue,
} from "@/lib/ethiopian-cities";
import { readJsonObject } from "@/lib/validation";

export async function GET() {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const routes = await prisma.route.findMany({
    where: { operatorId: authorization.user.id },
    include: { _count: { select: { trips: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(routes, { status: 200 });
}

export async function POST(request: Request) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const body = await readJsonObject(request);
  const rawOrigin = typeof body?.origin === "string" ? body.origin : "";
  const rawDestination =
    typeof body?.destination === "string" ? body.destination : "";
  const customDestinationEn =
    typeof body?.customDestinationEn === "string"
      ? body.customDestinationEn.trim()
      : "";
  const customDestinationAm =
    typeof body?.customDestinationAm === "string"
      ? body.customDestinationAm.trim()
      : "";

  if (!rawOrigin.trim() || !rawDestination.trim()) {
    return NextResponse.json(
      { error: "ROUTE_FIELDS_REQUIRED" },
      { status: 400 }
    );
  }

  const originCity = cityByValue(rawOrigin);
  const destinationCity = cityByValue(rawDestination);

  if (!originCity) {
    return NextResponse.json(
      { error: "INVALID_ROUTE_CITY" },
      { status: 400 },
    );
  }

  if (
    !destinationCity &&
    (!customDestinationEn ||
      !customDestinationAm ||
      customDestinationEn.length > 80 ||
      customDestinationAm.length > 80)
  ) {
    return NextResponse.json(
      { error: "CUSTOM_CITY_NAMES_REQUIRED" },
      { status: 400 },
    );
  }

  const originKey = originCity.value;
  const destinationKey = destinationCity
    ? destinationCity.value
    : normalizeCityValue(customDestinationEn);

  if (!destinationKey || destinationKey.length > 80) {
    return NextResponse.json(
      { error: "INVALID_ROUTE_CITY" },
      { status: 400 },
    );
  }

  if (originKey === destinationKey) {
    return NextResponse.json(
      { error: "ROUTE_SAME_CITY" },
      { status: 400 },
    );
  }

  const existing = await prisma.route.findUnique({
    where: {
      operatorId_originKey_destinationKey: {
        operatorId: authorization.user.id,
        originKey,
        destinationKey,
      },
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "ROUTE_EXISTS" },
      { status: 409 }
    );
  }

  try {
    const route = await prisma.route.create({
      data: {
        origin: originKey,
        destination: destinationKey,
        originKey,
        destinationKey,
        originEn: originCity.en,
        originAm: originCity.am,
        destinationEn: destinationCity?.en ?? customDestinationEn,
        destinationAm: destinationCity?.am ?? customDestinationAm,
        operatorId: authorization.user.id,
      },
      include: { _count: { select: { trips: true } } },
    });

    return NextResponse.json(route, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "ROUTE_EXISTS" },
        { status: 409 },
      );
    }
    throw error;
  }
}
