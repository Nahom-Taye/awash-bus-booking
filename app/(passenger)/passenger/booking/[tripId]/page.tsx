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

// --- Shared brand styling helpers (inline styles handle the live value;
// pseudo-states like focus/hover are wired through small event handlers) ---

const orangeCardStyle: React.CSSProperties = {
  background: "var(--awash-white)",
  borderRadius: "12px",
  borderLeft: "4px solid var(--awash-orange)",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
};

const plainCardStyle: React.CSSProperties = {
  background: "var(--awash-white)",
  borderRadius: "12px",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
};

const inputStyle: React.CSSProperties = {
  border: "1.5px solid #D6D6D6",
  color: "var(--awash-black)",
};

function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "var(--awash-blue)";
}

function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.borderColor = "#D6D6D6";
}

function handleOrangeBtnHover(e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) {
  e.currentTarget.style.background = "var(--awash-orange-dark)";
}

function handleOrangeBtnLeave(e: React.MouseEvent<HTMLButtonElement | HTMLAnchorElement>) {
  e.currentTarget.style.background = "var(--awash-orange)";
}

const orangeButtonStyle: React.CSSProperties = {
  background: "var(--awash-orange)",
};

// Hover on available seats: green border + light green background
function handleSeatHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = "var(--awash-success)";
  e.currentTarget.style.background = "#EAF7EF";
}

function handleSeatLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.borderColor = "#D6D6D6";
  e.currentTarget.style.background = "var(--awash-white)";
}

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

function Navbar() {
  return (
    <header
      className="sticky top-0 z-20 flex items-center justify-between px-4 sm:px-8"
      style={{ height: "64px", background: "var(--awash-black)" }}
    >
      <div className="flex items-baseline gap-2">
        <span className="text-lg font-bold text-white">AWASH BUS</span>
        <span className="text-sm text-white">|</span>
        <span className="text-lg font-bold" style={{ color: "var(--awash-gold)" }}>
          አዋሽ ባስ
        </span>
      </div>

      <a
        href="/passenger/dashboard"
        className="text-sm font-medium text-white transition hover:opacity-80"
      >
        Back to Search
      </a>
    </header>
  );
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
      <div className="min-h-screen" style={{ background: "var(--awash-grey-light)" }}>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <p style={{ color: "var(--awash-grey-dark)" }}>Loading trip...</p>
        </div>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen" style={{ background: "var(--awash-grey-light)" }}>
        <Navbar />
        <div className="flex min-h-[60vh] items-center justify-center px-4">
          <div
            className="w-full max-w-md p-6 text-center"
            style={{
              background: "var(--awash-orange-bg)",
              borderRadius: "12px",
              border: "1px solid var(--awash-error)",
            }}
          >
            <p className="text-sm" style={{ color: "var(--awash-error)" }}>
              {error ?? "Trip not found"}
            </p>
            <button
              onClick={fetchTrip}
              className="mt-3 text-sm font-medium underline"
              style={{ color: "var(--awash-error)" }}
            >
              Try again
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (confirmation) {
    const totalPrice = Number(trip.price) * confirmation.length;

    return (
      <div className="min-h-screen" style={{ background: "var(--awash-grey-light)" }}>
        <Navbar />
        <div className="px-4 py-10 sm:px-8">
          <div className="mx-auto w-full max-w-2xl">
            <div
              className="p-6"
              style={{
                background: "var(--awash-white)",
                borderRadius: "12px",
                border: "2px solid var(--awash-success)",
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
              }}
            >
              <h1 className="text-2xl font-bold" style={{ color: "var(--awash-success)" }}>
                Bookings confirmed
              </h1>
              <p className="mt-1 text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                {confirmation.length} seat
                {confirmation.length === 1 ? "" : "s"} reserved. Save your booking
                IDs for reference.
              </p>

              <dl className="mt-6 space-y-3 text-sm">
                <div className="flex justify-between gap-4">
                  <dt style={{ color: "var(--awash-grey-dark)" }}>Route</dt>
                  <dd className="font-semibold" style={{ color: "var(--awash-black)" }}>
                    {trip.route.origin} &rarr; {trip.route.destination}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt style={{ color: "var(--awash-grey-dark)" }}>Date</dt>
                  <dd className="font-semibold" style={{ color: "var(--awash-black)" }}>
                    {formatDate(trip.date)}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt style={{ color: "var(--awash-grey-dark)" }}>Departure</dt>
                  <dd className="font-semibold" style={{ color: "var(--awash-black)" }}>
                    {formatTime(trip.departureTime)}
                  </dd>
                </div>
              </dl>

              <div className="mt-6">
                <h2 className="mb-2 text-sm font-bold" style={{ color: "var(--awash-black)" }}>
                  Passengers
                </h2>
                <ul
                  className="overflow-hidden"
                  style={{
                    borderRadius: "8px",
                    border: "1px solid var(--awash-grey)",
                    background: "var(--awash-white)",
                  }}
                >
                  {confirmation.map((b) => (
                    <li
                      key={b.id}
                      className="flex items-center justify-between gap-4 px-4 py-3 text-sm"
                      style={{ borderTop: "1px solid var(--awash-grey)" }}
                    >
                      <div>
                        <p className="font-semibold" style={{ color: "var(--awash-black)" }}>
                          {b.fullName}
                        </p>
                        <p className="font-mono text-xs" style={{ color: "var(--awash-grey-dark)" }}>
                          {b.id}
                        </p>
                      </div>
                      <span
                        className="shrink-0 rounded-md px-2.5 py-1 text-xs font-semibold text-white"
                        style={{ background: "var(--awash-orange)" }}
                      >
                        Seat {b.seatNumber}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              <div
                className="mt-6 flex justify-between pt-4 text-base"
                style={{ borderTop: "1px solid var(--awash-grey)" }}
              >
                <span className="font-semibold" style={{ color: "var(--awash-black)" }}>
                  Total price
                </span>
                <span className="font-bold" style={{ color: "var(--awash-orange)" }}>
                  {totalPrice} ETB
                </span>
              </div>

              <a
                href="/passenger/dashboard"
                className="mt-6 block rounded-lg px-4 py-3 text-center text-sm font-semibold text-white transition"
                style={orangeButtonStyle}
                onMouseEnter={handleOrangeBtnHover}
                onMouseLeave={handleOrangeBtnLeave}
              >
                Back to Dashboard
              </a>
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
    <div className="min-h-screen" style={{ background: "var(--awash-grey-light)" }}>
      <Navbar />
      <div className="px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {/* Trip info header card */}
          <header className="mb-6 p-6" style={orangeCardStyle}>
            <h1 className="text-2xl font-bold" style={{ color: "var(--awash-black)" }}>
              {trip.route.origin}{" "}
              <span style={{ color: "var(--awash-orange)" }}>&rarr;</span>{" "}
              {trip.route.destination}
            </h1>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--awash-grey-dark)" }}>
              <span>{formatDate(trip.date)}</span>
              <span>Departs {formatTime(trip.departureTime)}</span>
              <span className="font-bold" style={{ color: "var(--awash-orange)" }}>
                {trip.price} ETB
              </span>
            </div>
          </header>

          {/* Seat map */}
          <section className="mb-8 p-6" style={plainCardStyle}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold" style={{ color: "var(--awash-black)" }}>
                Select Seats
              </h2>
              <span className="text-sm" style={{ color: "var(--awash-grey-dark)" }}>
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

                let seatStyle: React.CSSProperties;
                if (isBooked) {
                  seatStyle = {
                    border: "1px solid #D6D6D6",
                    background: "#D6D6D6",
                    color: "var(--awash-grey-dark)",
                  };
                } else if (isAdded) {
                  seatStyle = {
                    border: "1px solid var(--awash-orange)",
                    background: "var(--awash-orange)",
                    color: "var(--awash-white)",
                  };
                } else if (isSelected) {
                  seatStyle = {
                    border: "1px solid var(--awash-orange)",
                    background: "var(--awash-orange-bg)",
                    color: "var(--awash-orange-dark)",
                  };
                } else {
                  seatStyle = {
                    border: "1px solid #D6D6D6",
                    background: "var(--awash-white)",
                    color: "var(--awash-black)",
                  };
                }

                const isAvailable = !isBooked && !isAdded && !isSelected;

                return (
                  <button
                    key={seat}
                    type="button"
                    disabled={isBooked}
                    onClick={() => handleSeatClick(seat)}
                    title={passenger?.fullName}
                    onMouseEnter={isAvailable ? handleSeatHover : undefined}
                    onMouseLeave={isAvailable ? handleSeatLeave : undefined}
                    className={`flex flex-col items-center justify-center rounded-lg px-1 py-3 text-sm font-medium transition ${
                      isBooked ? "cursor-not-allowed" : ""
                    }`}
                    style={seatStyle}
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

            {/* Legend */}
            <div className="mt-4 flex flex-wrap gap-4 text-xs" style={{ color: "var(--awash-grey-dark)" }}>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ border: "1px solid #D6D6D6", background: "var(--awash-white)" }} />
                Available
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: "var(--awash-orange)" }} />
                Selected
              </span>
              <span className="flex items-center gap-2">
                <span className="inline-block h-3 w-3 rounded" style={{ background: "#D6D6D6" }} />
                Booked
              </span>
            </div>
          </section>

          {/* Passenger form */}
          {selectedSeat !== null && (
            <section className="mb-8 p-6" style={orangeCardStyle}>
              <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-black)" }}>
                Passenger for seat {selectedSeat}
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="full-name"
                    className="mb-1 block text-sm font-medium"
                    style={{ color: "var(--awash-charcoal)" }}
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
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full rounded-lg px-3 py-2 outline-none transition"
                    style={inputStyle}
                    placeholder="Abebe Bekele"
                  />
                </div>

                <div>
                  <label
                    htmlFor="phone"
                    className="mb-1 block text-sm font-medium"
                    style={{ color: "var(--awash-charcoal)" }}
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
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full rounded-lg px-3 py-2 outline-none transition"
                    style={inputStyle}
                    placeholder="0911234567"
                  />
                </div>

                <div>
                  <label
                    htmlFor="email"
                    className="mb-1 block text-sm font-medium"
                    style={{ color: "var(--awash-charcoal)" }}
                  >
                    Email <span style={{ color: "var(--awash-grey-dark)" }}>(optional)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={currentForm.email}
                    onChange={(e) =>
                      setCurrentForm((f) => ({ ...f, email: e.target.value }))
                    }
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full rounded-lg px-3 py-2 outline-none transition"
                    style={inputStyle}
                    placeholder="abebe@example.com"
                  />
                </div>
              </div>

              {formError && (
                <p className="mt-4 text-sm" style={{ color: "var(--awash-error)" }}>
                  {formError}
                </p>
              )}

              <div className="mt-4 flex gap-3">
                <button
                  type="button"
                  onClick={handleAddPassenger}
                  className="rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
                  style={orangeButtonStyle}
                  onMouseEnter={handleOrangeBtnHover}
                  onMouseLeave={handleOrangeBtnLeave}
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
                  className="rounded-lg px-4 py-2 text-sm font-medium transition"
                  style={{
                    background: "var(--awash-white)",
                    border: "1.5px solid #D6D6D6",
                    color: "var(--awash-charcoal)",
                  }}
                >
                  Cancel
                </button>
              </div>
            </section>
          )}

          {/* Summary */}
          <section className="p-6" style={orangeCardStyle}>
            <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-black)" }}>
              Summary
            </h2>

            {passengerList.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                No passengers added yet. Select a seat to begin.
              </p>
            ) : (
              <ul>
                {passengerList.map(([seat, details], idx) => (
                  <li
                    key={seat}
                    className="flex items-center justify-between gap-4 py-3"
                    style={idx > 0 ? { borderTop: "1px solid var(--awash-grey)" } : undefined}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-semibold text-white"
                        style={{ background: "var(--awash-orange)" }}
                      >
                        {seat}
                      </span>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: "var(--awash-black)" }}>
                          {details.fullName}
                        </p>
                        <p className="text-xs" style={{ color: "var(--awash-grey-dark)" }}>
                          {details.phone}
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSeatClick(seat)}
                      className="text-sm font-medium transition hover:opacity-80"
                      style={{ color: "var(--awash-error)" }}
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {passengerList.length > 0 && (
              <div
                className="mt-4 flex justify-between pt-4 text-sm"
                style={{ borderTop: "1px solid var(--awash-grey)" }}
              >
                <span style={{ color: "var(--awash-grey-dark)" }}>Total price</span>
                <span className="font-bold" style={{ color: "var(--awash-orange)" }}>
                  {Number(trip.price) * passengerList.length} ETB
                </span>
              </div>
            )}

            {formError && selectedSeat === null && (
              <p className="mt-4 text-sm" style={{ color: "var(--awash-error)" }}>
                {formError}
              </p>
            )}

            <button
              type="button"
              onClick={handleConfirmAll}
              disabled={submitting || passengers.size === 0}
              className="mt-4 w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
              style={orangeButtonStyle}
              onMouseEnter={passengers.size > 0 && !submitting ? handleOrangeBtnHover : undefined}
              onMouseLeave={passengers.size > 0 && !submitting ? handleOrangeBtnLeave : undefined}
            >
              {submitting ? "Confirming..." : "Confirm All Bookings"}
            </button>
          </section>
        </div>
      </div>
    </div>
  );
}
