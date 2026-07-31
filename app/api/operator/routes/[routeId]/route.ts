import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import { readJsonObject } from "@/lib/validation";

type RouteAction = "delete" | "archive";

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ routeId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { routeId } = await params;
  const body = await readJsonObject(request);
  const action: RouteAction = body?.action === "archive" ? "archive" : "delete";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        const route = await tx.route.findUnique({
        where: { id: routeId },
        include: { _count: { select: { trips: true } } },
      });

      if (!route) return { status: 404 as const, error: "ROUTE_NOT_FOUND" };
      if (route.operatorId !== authorization.user.id) {
        return { status: 403 as const, error: "FORBIDDEN" };
      }

      const tripCount = route._count.trips;

      if (action === "archive") {
        if (tripCount === 0) {
          return {
            status: 409 as const,
            error: "ROUTE_CAN_BE_DELETED",
            canArchive: false,
            tripCount,
          };
        }
        if (!route.isActive) {
          return {
            status: 409 as const,
            error: "ROUTE_ALREADY_ARCHIVED",
            canArchive: false,
            tripCount,
          };
        }

        const archived = await tx.route.update({
          where: { id: routeId },
          data: { isActive: false, archivedAt: new Date() },
          include: { _count: { select: { trips: true } } },
        });
        return { status: 200 as const, outcome: "archived", item: archived };
      }

      if (tripCount > 0) {
        return {
          status: 409 as const,
          error: "ROUTE_HAS_TRIPS",
          canArchive: route.isActive,
          tripCount,
        };
      }

      await tx.route.delete({ where: { id: routeId } });
        return { status: 200 as const, outcome: "deleted", item: route };
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
        { error: "ROUTE_HAS_TRIPS", canArchive: true },
        { status: 409 },
      );
    }
    throw error;
  }
}
