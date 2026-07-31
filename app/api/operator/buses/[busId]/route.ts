import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { readJsonObject } from "@/lib/validation";
import { ethiopiaWallClockAsUtc } from "@/lib/lifecycle";

type BusAction = "delete" | "archive";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ busId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { busId } = await params;
  const body = await readJsonObject(request);
  const action: BusAction = body?.action === "archive" ? "archive" : "delete";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const bus = await tx.bus.findUnique({
        where: { id: busId },
        include: {
          _count: { select: { trips: true } },
          trips: {
            where: {
              status: "SCHEDULED",
              departureTime: { gt: ethiopiaWallClockAsUtc() },
            },
            select: {
              id: true,
              date: true,
              departureTime: true,
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
            },
            orderBy: { departureTime: "asc" },
            take: 5,
          },
        },
      });

      if (!bus) return { status: 404 as const, error: "BUS_NOT_FOUND" };
      if (bus.operatorId !== authorization.user.id) {
        return { status: 403 as const, error: "FORBIDDEN" };
      }

      const tripCount = bus._count.trips;
      const upcomingTrips = bus.trips;

      if (upcomingTrips.length > 0) {
        return {
          status: 409 as const,
          error: "BUS_HAS_UPCOMING_TRIPS",
          canArchive: false,
          tripCount,
          upcomingTrips,
        };
      }

      if (action === "archive") {
        if (tripCount === 0) {
          return {
            status: 409 as const,
            error: "BUS_CAN_BE_DELETED",
            canArchive: false,
            tripCount,
          };
        }
        if (!bus.isActive) {
          return {
            status: 409 as const,
            error: "BUS_ALREADY_ARCHIVED",
            canArchive: false,
            tripCount,
          };
        }

        const archived = await tx.bus.update({
          where: { id: busId },
          data: { isActive: false, archivedAt: new Date() },
          include: { _count: { select: { trips: true } } },
        });
        return { status: 200 as const, outcome: "archived", item: archived };
      }

      if (tripCount > 0) {
        return {
          status: 409 as const,
          error: "BUS_HAS_TRIP_HISTORY",
          canArchive: bus.isActive,
          tripCount,
        };
      }

      await tx.bus.delete({ where: { id: busId } });
        return { status: 200 as const, outcome: "deleted", item: bus };
      },
      { maxWait: 5_000, timeout: 15_000 },
    );

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2003"
    ) {
      return NextResponse.json(
        { error: "BUS_HAS_TRIP_HISTORY", canArchive: true },
        { status: 409 },
      );
    }
    throw error;
  }
}
