import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { requireRole } from "@/lib/authorization";
import {
  reconcileLifecycleInTransaction,
  tripDeletionEligibility,
} from "@/lib/lifecycle";
import { readJsonObject } from "@/lib/validation";

type TripAction = "delete" | "cancel" | "archive";

class UnsafeTripDeletionError extends Error {}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ tripId: string }> },
) {
  const authorization = await requireRole("OPERATOR");
  if (authorization.response) return authorization.response;

  const { tripId } = await params;
  const body = await readJsonObject(request);
  const action: TripAction =
    body?.action === "cancel"
      ? "cancel"
      : body?.action === "archive"
        ? "archive"
        : "delete";

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        await reconcileLifecycleInTransaction(tx, {
          tripId,
          operatorId: authorization.user.id,
          deleteExpired: false,
        });
        const trip = await tx.trip.findUnique({
          where: { id: tripId },
          include: {
            route: true,
            bus: true,
            bookings: {
              select: {
                id: true,
                status: true,
                payments: { select: { status: true } },
              },
            },
          },
        });

        if (!trip) return { status: 404 as const, error: "TRIP_NOT_FOUND" };
        if (trip.operatorId !== authorization.user.id) {
          return { status: 403 as const, error: "FORBIDDEN" };
        }

        const lifecycle = tripDeletionEligibility(trip.status, trip.bookings);

        if (action === "delete") {
          if (!lifecycle.canDelete) {
            return {
              status: 409 as const,
              error: "TRIP_DELETE_UNSAFE",
              lifecycle,
            };
          }

          if (trip.bookings.length > 0) {
            const deletedBookings = await tx.booking.deleteMany({
              where: {
                tripId,
                status: "EXPIRED",
                payments: { none: {} },
              },
            });
            if (deletedBookings.count !== trip.bookings.length) {
              throw new UnsafeTripDeletionError();
            }
          }

          const deleted = await tx.trip.deleteMany({
            where: { id: tripId, operatorId: authorization.user.id },
          });
          if (deleted.count !== 1) {
            throw new UnsafeTripDeletionError();
          }
          return {
            status: 200 as const,
            outcome: "deleted" as const,
            deletedExpiredBookings: trip.bookings.length,
          };
        }

        if (action === "archive") {
          if (trip.status === "ARCHIVED") {
            return {
              status: 409 as const,
              error: "TRIP_ALREADY_ARCHIVED",
              lifecycle,
            };
          }
          if (trip.status === "SCHEDULED") {
            return {
              status: 409 as const,
              error: "TRIP_MUST_BE_CANCELLED_FIRST",
              lifecycle,
            };
          }

          await tx.trip.update({
            where: { id: tripId },
            data: { status: "ARCHIVED", archivedAt: new Date() },
          });
          return {
            status: 200 as const,
            outcome: "archived" as const,
            lifecycle,
          };
        }

        if (trip.status === "CANCELLED") {
          return {
            status: 409 as const,
            error: "TRIP_ALREADY_CANCELLED",
            lifecycle,
          };
        }
        if (trip.status !== "SCHEDULED") {
          return {
            status: 409 as const,
            error: "TRIP_NOT_CANCELLABLE",
            lifecycle,
          };
        }
        if (lifecycle.canDelete) {
          return {
            status: 409 as const,
            error: "TRIP_CAN_BE_DELETED",
            lifecycle,
          };
        }

        const cancelledBookings = await tx.booking.updateMany({
          where: {
            tripId,
            status: { in: ["PENDING", "CONFIRMED"] },
          },
          data: {
            status: "CANCELLED",
            seatKey: null,
            holdExpiresAt: null,
          },
        });
        await tx.trip.update({
          where: { id: tripId },
          data: { status: "CANCELLED" },
        });

        return {
          status: 200 as const,
          outcome: "cancelled" as const,
          movedBookingsToHistory: cancelledBookings.count,
          refundRequiredCount: lifecycle.refundRequiredCount,
        };
      },
      { maxWait: 5_000, timeout: 20_000 },
    );

    if ("error" in result) {
      return NextResponse.json(result, { status: result.status });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    if (error instanceof UnsafeTripDeletionError) {
      return NextResponse.json(
        { error: "TRIP_DELETE_CONFLICT" },
        { status: 409 },
      );
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2003" || error.code === "P2025")
    ) {
      return NextResponse.json(
        { error: "TRIP_DELETE_UNSAFE" },
        { status: 409 },
      );
    }
    throw error;
  }
}
