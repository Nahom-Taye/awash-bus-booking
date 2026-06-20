"use client";

import { useCallback, useEffect, useState, use } from "react";

interface Route {
  id: string;
  origin: string;
  destination: string;
}

interface Bus {
  id: string;
  plateNumber: string;
  totalSeats: number;
}

type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";
type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

interface Booking {
  id: string;
  seatNumber: number;
  status: BookingStatus;
}

interface Trip {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  status: TripStatus;
  route: Route;
  bus: Bus;
  bookings: Booking[];
}

interface PassengerDetails {
  fullName: string;
  phone: string;
  email: string;
}

interface Confirmation {
  id: string;
  seatNumber: number;
  fullName: string;
}

const SEATS_PER_ROW = 6;
const MAX_SEATS = 6;

const EMPTY_FORM: PassengerDetails = { fullName: "", phone: "", email: "" };

function formatDate(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function BookingPage({
  params,
}: {
  params: Promise<{ tripId: string }>;
}) {
  const { tripId } = use(params);

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedSeat, setSelectedSeat] = useState<number | null>(null);
  const [passengers, setPassengers] = useState<Map<number, PassengerDetails>>(
    new Map()
  );
  const [currentForm, setCurrentForm] = useState<PassengerDetails>(EMPTY_FORM);

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [confirmation, setConfirmation] = useState<Confirmation[] | null>(null);

  const fetchTrip = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/trips/${tripId}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load trip");
      }

      const data: Trip = await res.json();
      setTrip(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trip");
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    fetchTrip();
  }, [fetchTrip]);

  const handleSeatClick = (seat: number) => {
    setFormError(null);

    // Clicking an already-added seat removes that passenger.
    if (passengers.has(seat)) {
      setPassengers((prev) => {
        const next = new Map(prev);
        next.delete(seat);
        return next;
      });
      if (selectedSeat === seat) {
        setSelectedSeat(null);
        setCurrentForm(EMPTY_FORM);
      }
      return;
    }

    // Opening the form for a new seat — enforce the seat cap.
    if (passengers.size >= MAX_SEATS) {
      setFormError(`You can book at most ${MAX_SEATS} seats`);
      return;
    }

    setSelectedSeat(seat);
    setCurrentForm(EMPTY_FORM);
  };

  const handleAddPassenger = () => {
    setFormError(null);

    if (selectedSeat === null) {
      setFormError("Please select a seat");
      return;
    }

    if (!currentForm.fullName.trim() || !currentForm.phone.trim()) {
      setFormError("Full name and phone number are required");
      return;
    }

    setPassengers((prev) => {
      const next = new Map(prev);
      next.set(selectedSeat, {
        fullName: currentForm.fullName.trim(),
        phone: currentForm.phone.trim(),
        email: currentForm.email.trim(),
      });
      return next;
    });

    setSelectedSeat(null);
    setCurrentForm(EMPTY_FORM);
  };

  const handleConfirmAll = async () => {
    setFormError(null);

    if (passengers.size === 0) return;

    setSubmitting(true);

    try {
      const payload = {
        tripId,
        passengers: Array.from(passengers.entries()).map(
          ([seatNumber, details]) => ({
            seatNumber,
            fullName: details.fullName,
            phone: details.phone,
            email: details.email || undefined,
          })
        ),
      };

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create bookings");
      }

      const data: Confirmation[] = await res.json();
      setConfirmation(data);
    } catch (err) {
      setFormError(
        err instanceof Error ? err.message : "Failed to create bookings"
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <p className="text-gray-600">Loading trip...</p>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-600">{error ?? "Trip not found"}</p>
          <button
            onClick={fetchTrip}
            className="mt-3 text-sm font-medium text-red-700 underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (confirmation) {
    const totalPrice = Number(trip.price) * confirmation.length;

    return (
      <div className="min-h-screen bg-gray-50 px-4 py-10">
        <div className="mx-auto w-full max-w-2xl">
          <div className="rounded-xl border border-green-200 bg-green-50 p-6 shadow-sm">
            <h1 className="text-2xl font-bold text-green-800">
              Bookings confirmed
            </h1>
            <p className="mt-1 text-sm text-green-700">
              {confirmation.length} seat
              {confirmation.length === 1 ? "" : "s"} reserved. Save your booking
              IDs for reference.
            </p>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Route</dt>
                <dd className="font-medium text-gray-900">
                  {trip.route.origin} &rarr; {trip.route.destination}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Date</dt>
                <dd className="font-medium text-gray-900">
                  {formatDate(trip.date)}
                </dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-gray-500">Departure</dt>
                <dd className="font-medium text-gray-900">
                  {formatTime(trip.departureTime)}
                </dd>
              </div>
            </dl>

            <div className="mt-6">
              <h2 className="mb-2 text-sm font-semibold text-gray-900">
                Passengers
              </h2>
              <ul className="divide-y divide-green-200 rounded-lg border border-green-200 bg-white">
                {confirmation.map((b) => (
                  <li
                    key={b.id}
                    className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-medium text-gray-900">{b.fullName}</p>
                      <p className="font-mono text-xs text-gray-500">{b.id}</p>
                    </div>
                    <span className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 text-xs font-medium text-white">
                      Seat {b.seatNumber}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="mt-6 flex justify-between border-t border-green-200 pt-4 text-base">
              <span className="font-semibold text-gray-900">Total price</span>
              <span className="font-bold text-gray-900">{totalPrice} ETB</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const bookedSeats = new Set(
    trip.bookings
      .filter((b) => b.status === "CONFIRMED")
      .map((b) => b.seatNumber)
  );

  const seats = Array.from({ length: trip.bus.totalSeats }, (_, i) => i + 1);

  const passengerList = Array.from(passengers.entries()).sort(
    ([a], [b]) => a - b
  );

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h1 className="text-2xl font-bold text-gray-900">
            {trip.route.origin}{" "}
            <span className="text-gray-400">&rarr;</span>{" "}
            {trip.route.destination}
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
            <span>{formatDate(trip.date)}</span>
            <span>Departs {formatTime(trip.departureTime)}</span>
            <span className="font-medium text-gray-900">{trip.price} ETB</span>
          </div>
        </header>

        <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">Select seats</h2>
            <span className="text-sm text-gray-500">
              {passengers.size}/{MAX_SEATS} selected
            </span>
          </div>

          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${SEATS_PER_ROW}, minmax(0, 1fr))`,
            }}
          >
            {seats.map((seat) => {
              const isBooked = bookedSeats.has(seat);
              const isAdded = passengers.has(seat);
              const isSelected = selectedSeat === seat;
              const passenger = passengers.get(seat);

              const firstName = passenger?.fullName.split(" ")[0] ?? "";

              return (
                <button
                  key={seat}
                  type="button"
                  disabled={isBooked}
                  onClick={() => handleSeatClick(seat)}
                  title={passenger?.fullName}
                  className={`flex flex-col items-center justify-center rounded-lg border px-1 py-3 text-sm font-medium transition ${
                    isBooked
                      ? "cursor-not-allowed border-gray-200 bg-gray-200 text-gray-400"
                      : isAdded
                        ? "border-blue-600 bg-blue-600 text-white"
                        : isSelected
                          ? "border-blue-600 bg-blue-50 text-blue-700 ring-2 ring-blue-200"
                          : "border-gray-300 bg-white text-gray-900 hover:border-green-500 hover:bg-green-50"
                  }`}
                >
                  <span>{seat}</span>
                  {isAdded && (
                    <span className="mt-0.5 max-w-full truncate text-[10px] font-normal">
                      {firstName}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-600">
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded border border-gray-300 bg-white" />
              Available
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-blue-600" />
              Added
            </span>
            <span className="flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded bg-gray-200" />
              Booked
            </span>
          </div>
        </section>

        {selectedSeat !== null && (
          <section className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold text-gray-900">
              Passenger for seat {selectedSeat}
            </h2>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label
                  htmlFor="full-name"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Full name
                </label>
                <input
                  id="full-name"
                  type="text"
                  required
                  value={currentForm.fullName}
                  onChange={(e) =>
                    setCurrentForm((f) => ({ ...f, fullName: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="Abebe Bekele"
                />
              </div>

              <div>
                <label
                  htmlFor="phone"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Phone number
                </label>
                <input
                  id="phone"
                  type="tel"
                  required
                  value={currentForm.phone}
                  onChange={(e) =>
                    setCurrentForm((f) => ({ ...f, phone: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="0911234567"
                />
              </div>

              <div>
                <label
                  htmlFor="email"
                  className="mb-1 block text-sm font-medium text-gray-700"
                >
                  Email <span className="text-gray-400">(optional)</span>
                </label>
                <input
                  id="email"
                  type="email"
                  value={currentForm.email}
                  onChange={(e) =>
                    setCurrentForm((f) => ({ ...f, email: e.target.value }))
                  }
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                  placeholder="abebe@example.com"
                />
              </div>
            </div>

            {formError && (
              <p className="mt-4 text-sm text-red-600">{formError}</p>
            )}

            <div className="mt-4 flex gap-3">
              <button
                type="button"
                onClick={handleAddPassenger}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                Add Passenger
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedSeat(null);
                  setCurrentForm(EMPTY_FORM);
                  setFormError(null);
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </section>
        )}

        <section className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Summary
          </h2>

          {passengerList.length === 0 ? (
            <p className="text-sm text-gray-600">
              No passengers added yet. Select a seat to begin.
            </p>
          ) : (
            <ul className="divide-y divide-gray-200">
              {passengerList.map(([seat, details]) => (
                <li
                  key={seat}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-600 text-xs font-semibold text-white">
                      {seat}
                    </span>
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {details.fullName}
                      </p>
                      <p className="text-xs text-gray-500">{details.phone}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSeatClick(seat)}
                    className="text-sm font-medium text-red-600 transition hover:text-red-700"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          )}

          {passengerList.length > 0 && (
            <div className="mt-4 flex justify-between border-t border-gray-200 pt-4 text-sm">
              <span className="text-gray-500">Total price</span>
              <span className="font-semibold text-gray-900">
                {Number(trip.price) * passengerList.length} ETB
              </span>
            </div>
          )}

          {formError && selectedSeat === null && (
            <p className="mt-4 text-sm text-red-600">{formError}</p>
          )}

          <button
            type="button"
            onClick={handleConfirmAll}
            disabled={submitting || passengers.size === 0}
            className="mt-4 w-full rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {submitting ? "Confirming..." : "Confirm All Bookings"}
          </button>
        </section>
      </div>
    </div>
  );
}
