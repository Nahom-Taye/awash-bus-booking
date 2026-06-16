import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

interface CreateRouteBody {
  origin?: string;
  destination?: string;
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const routes = await prisma.route.findMany({
    where: { operatorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(routes, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { origin, destination }: CreateRouteBody = await request
    .json()
    .catch(() => ({}));

  if (!origin?.trim() || !destination?.trim()) {
    return NextResponse.json(
      { error: "origin and destination are required" },
      { status: 400 }
    );
  }

  const trimmedOrigin = origin.trim();
  const trimmedDestination = destination.trim();

  const existing = await prisma.route.findFirst({
    where: {
      operatorId: session.user.id,
      origin: trimmedOrigin,
      destination: trimmedDestination,
    },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A route with this origin and destination already exists" },
      { status: 409 }
    );
  }

  const route = await prisma.route.create({
    data: {
      origin: trimmedOrigin,
      destination: trimmedDestination,
      operatorId: session.user.id,
    },
  });

  return NextResponse.json(route, { status: 201 });
}
