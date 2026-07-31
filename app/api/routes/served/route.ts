import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { normalizeServedRoutes } from "@/lib/served-routes";
import { ethiopiaWallClockAsUtc } from "@/lib/lifecycle";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  const now = ethiopiaWallClockAsUtc();
  const routes = await prisma.route.findMany({
    where: {
      operator: { role: "OPERATOR" },
      isActive: true,
      archivedAt: null,
      trips: {
        some: {
          status: "SCHEDULED",
          departureTime: { gt: now },
          bus: {
            isActive: true,
            archivedAt: null,
            operator: { role: "OPERATOR" },
          },
        },
      },
    },
    select: {
      id: true,
      originKey: true,
      destinationKey: true,
      originEn: true,
      originAm: true,
      destinationEn: true,
      destinationAm: true,
    },
    orderBy: [{ originKey: "asc" }, { destinationKey: "asc" }],
  });

  const servedRoutes = normalizeServedRoutes(routes);

  return NextResponse.json(
    { routes: servedRoutes },
    {
      status: 200,
      headers: { "Cache-Control": "public, max-age=15, stale-while-revalidate=30" },
    },
  );
}
