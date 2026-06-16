import { NextResponse } from "next/server";
import { auth } from "@/auth";
import prisma from "@/lib/prisma";

interface CreateBusBody {
  name?: string;
  plateNumber?: string;
  totalSeats?: number;
}

export async function GET() {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buses = await prisma.bus.findMany({
    where: { operatorId: session.user.id },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(buses, { status: 200 });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role !== "OPERATOR") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { name, plateNumber, totalSeats }: CreateBusBody = await request
    .json()
    .catch(() => ({}));

  if (!name?.trim() || !plateNumber?.trim()) {
    return NextResponse.json(
      { error: "name and plateNumber are required" },
      { status: 400 }
    );
  }

  if (
    typeof totalSeats !== "number" ||
    !Number.isInteger(totalSeats) ||
    totalSeats <= 0
  ) {
    return NextResponse.json(
      { error: "totalSeats must be a positive integer" },
      { status: 400 }
    );
  }

  const trimmedName = name.trim();
  const trimmedPlateNumber = plateNumber.trim();

  const existing = await prisma.bus.findUnique({
    where: { plateNumber: trimmedPlateNumber },
  });

  if (existing) {
    return NextResponse.json(
      { error: "A bus with this plate number already exists" },
      { status: 409 }
    );
  }

  const bus = await prisma.bus.create({
    data: {
      name: trimmedName,
      plateNumber: trimmedPlateNumber,
      totalSeats,
      operatorId: session.user.id,
    },
  });

  return NextResponse.json(bus, { status: 201 });
}
