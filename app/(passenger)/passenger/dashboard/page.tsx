"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";

interface Route {
  id: string;
  origin: string;
  destination: string;
  operatorId: string;
  createdAt: string;
  updatedAt: string;
}

interface Bus {
  id: string;
  plateNumber: string;
  totalSeats: number;
  operatorId: string;
  createdAt: string;
  updatedAt: string;
}

type TripStatus = "SCHEDULED" | "CANCELLED" | "COMPLETED";

interface Trip {
  id: string;
  date: string;
  departureTime: string;
  arrivalTime: string;
  price: string;
  status: TripStatus;
  routeId: string;
  busId: string;
  operatorId: string;
  route: Route;
  bus: Bus;
  _count: { bookings: number };
  createdAt: string;
  updatedAt: string;
}

function formatTime(value: string): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
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

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

interface BookingRecord {
  id: string;
  seatNumber: number;
  fullName: string;
  phone: string;
  status: BookingStatus;
  createdAt: string;
  trip: {
    date: string;
    departureTime: string;
    arrivalTime: string;
    price: string;
    route: {
      origin: string;
      destination: string;
    };
    bus: {
      plateNumber: string;
    };
  };
}

type Tab = "search" | "bookings";

const TABS: { key: Tab; label: string }[] = [
  { key: "search", label: "Search Trips" },
  { key: "bookings", label: "My Bookings" },
];

const INPUT_STYLE: React.CSSProperties = {
  border: "1.5px solid var(--awash-grey-medium)",
  borderRadius: "8px",
  color: "var(--awash-charcoal)",
};

function handleInputFocus(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.border = "1.5px solid var(--awash-blue)";
}

function handleInputBlur(e: React.FocusEvent<HTMLInputElement>) {
  e.currentTarget.style.border = "1.5px solid var(--awash-grey-medium)";
}

export default function PassengerDashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("search");

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");

  const [trips, setTrips] = useState<Trip[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    if (!origin.trim() || !destination.trim() || !date) {
      setError("Origin, destination, and date are required");
      return;
    }

    setLoading(true);

    try {
      const params = new URLSearchParams({
        origin: origin.trim(),
        destination: destination.trim(),
        date,
      });

      const res = await fetch(`/api/trips/search?${params.toString()}`);

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to search trips");
      }

      const data: Trip[] = await res.json();
      setTrips(data);
    } catch (err) {
      setTrips(null);
      setError(err instanceof Error ? err.message : "Failed to search trips");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--awash-grey-light)" }}>
      {/* Top navbar */}
      <header
        className="sticky top-0 z-20 flex items-center justify-between px-6"
        style={{ height: "64px", background: "var(--awash-black)" }}
      >
        <span className="text-lg font-bold">
          <span style={{ color: "var(--awash-white)" }}>AWASH BUS | </span>
          <span style={{ color: "var(--awash-gold)" }}>አዋሽ ባስ</span>
        </span>

        <div className="flex items-center gap-4">
          <span className="text-sm" style={{ color: "var(--awash-white)" }}>
            {status === "loading"
              ? "Loading..."
              : (session?.user?.fullName ?? "Guest")}
          </span>
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg px-4 py-2 text-sm font-semibold transition"
            style={{ background: "var(--awash-orange)", color: "var(--awash-white)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--awash-orange-dark)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--awash-orange)")
            }
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav
        className="flex gap-1 px-6"
        style={{
          background: "var(--awash-white)",
          borderBottom: "1px solid var(--awash-grey)",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="-mb-px px-4 py-3 text-sm font-medium transition"
              style={{
                borderBottom: active
                  ? "2px solid var(--awash-orange)"
                  : "2px solid transparent",
                color: active
                  ? "var(--awash-orange)"
                  : "var(--awash-grey-dark)",
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </nav>

      <div className="mx-auto w-full max-w-2xl px-4 py-10">
        {activeTab === "search" && (
          <>
            <form
              onSubmit={handleSubmit}
              className="mb-8 p-6"
              style={{
                background: "var(--awash-white)",
                borderRadius: "12px",
                borderLeft: "4px solid var(--awash-orange)",
                boxShadow:
                  "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -2px rgba(0,0,0,0.05)",
              }}
            >
              <h2
                className="mb-4 text-lg font-bold"
                style={{ color: "var(--awash-black)" }}
              >
                Search Available Trips
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label
                    htmlFor="origin"
                    className="mb-1 block text-sm font-medium"
                    style={{ color: "var(--awash-charcoal)" }}
                  >
                    Origin
                  </label>
                  <input
                    id="origin"
                    type="text"
                    required
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full px-3 py-2 focus:outline-none"
                    style={INPUT_STYLE}
                    placeholder="Addis Ababa"
                  />
                </div>

                <div>
                  <label
                    htmlFor="destination"
                    className="mb-1 block text-sm font-medium"
                    style={{ color: "var(--awash-charcoal)" }}
                  >
                    Destination
                  </label>
                  <input
                    id="destination"
                    type="text"
                    required
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full px-3 py-2 focus:outline-none"
                    style={INPUT_STYLE}
                    placeholder="Awash"
                  />
                </div>

                <div>
                  <label
                    htmlFor="date"
                    className="mb-1 block text-sm font-medium"
                    style={{ color: "var(--awash-charcoal)" }}
                  >
                    Date
                  </label>
                  <input
                    id="date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    onFocus={handleInputFocus}
                    onBlur={handleInputBlur}
                    className="w-full px-3 py-2 focus:outline-none"
                    style={INPUT_STYLE}
                  />
                </div>
              </div>

              {error && (
                <p className="mt-4 text-sm" style={{ color: "var(--awash-error)" }}>
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                style={{
                  background: "var(--awash-orange)",
                  color: "var(--awash-white)",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = "var(--awash-orange-dark)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = "var(--awash-orange)")
                }
              >
                {loading ? "Searching..." : "Search"}
              </button>
            </form>

            <section>
              {loading ? (
                <p style={{ color: "var(--awash-grey-dark)" }}>Searching trips...</p>
              ) : trips === null ? (
                <p style={{ color: "var(--awash-grey-dark)" }}>
                  Enter your trip details above to search.
                </p>
              ) : trips.length === 0 ? (
                <p style={{ color: "var(--awash-grey-dark)" }}>No trips found.</p>
              ) : (
                <ul className="space-y-3">
                  {trips.map((trip) => {
                    const availableSeats =
                      trip.bus.totalSeats - trip._count.bookings;
                    const soldOut = availableSeats <= 0;

                    return (
                      <li
                        key={trip.id}
                        className="p-4 transition"
                        style={{
                          background: "var(--awash-white)",
                          borderRadius: "12px",
                          borderTop: "4px solid var(--awash-orange)",
                          boxShadow:
                            "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = "translateY(-3px)";
                          e.currentTarget.style.boxShadow =
                            "0 12px 20px -4px rgba(0,0,0,0.15), 0 6px 8px -2px rgba(0,0,0,0.08)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = "translateY(0)";
                          e.currentTarget.style.boxShadow =
                            "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)";
                        }}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p
                              className="font-bold"
                              style={{ color: "var(--awash-black)" }}
                            >
                              {trip.route.origin}{" "}
                              <span style={{ color: "var(--awash-grey-dark)" }}>
                                &rarr;
                              </span>{" "}
                              {trip.route.destination}
                            </p>
                            <p
                              className="mt-1 text-sm"
                              style={{ color: "var(--awash-grey-dark)" }}
                            >
                              Bus {trip.bus.plateNumber}
                            </p>
                          </div>
                          <span
                            className="font-bold"
                            style={{ color: "var(--awash-orange)" }}
                          >
                            {trip.price} ETB
                          </span>
                        </div>

                        <div
                          className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                          style={{ color: "var(--awash-grey-dark)" }}
                        >
                          <span>
                            {formatTime(trip.departureTime)} &ndash;{" "}
                            {formatTime(trip.arrivalTime)}
                          </span>
                          <span
                            className="font-semibold"
                            style={{
                              color: soldOut
                                ? "var(--awash-error)"
                                : "var(--awash-success)",
                            }}
                          >
                            {soldOut
                              ? "Sold out"
                              : `${availableSeats} seat${
                                  availableSeats === 1 ? "" : "s"
                                } available`}
                          </span>
                        </div>

                        <div className="mt-4">
                          {soldOut ? (
                            <button
                              type="button"
                              disabled
                              className="rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50"
                              style={{
                                background: "var(--awash-orange)",
                                color: "var(--awash-white)",
                              }}
                            >
                              Book Now
                            </button>
                          ) : (
                            <Link
                              href={`/passenger/booking/${trip.id}`}
                              className="inline-block rounded-lg px-4 py-2 text-sm font-semibold transition"
                              style={{
                                background: "var(--awash-orange)",
                                color: "var(--awash-white)",
                              }}
                              onMouseEnter={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--awash-orange-dark)")
                              }
                              onMouseLeave={(e) =>
                                (e.currentTarget.style.background =
                                  "var(--awash-orange)")
                              }
                            >
                              Book Now
                            </Link>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </>
        )}

        {activeTab === "bookings" && <MyBookingsTab />}
      </div>
    </div>
  );
}

const BOOKING_STATUS_STYLES: Record<BookingStatus, React.CSSProperties> = {
  PENDING: { background: "var(--awash-warning)", color: "var(--awash-white)" },
  CONFIRMED: { background: "var(--awash-success)", color: "var(--awash-white)" },
  CANCELLED: { background: "var(--awash-error)", color: "var(--awash-white)" },
};

function MyBookingsTab() {
  const [bookings, setBookings] = useState<BookingRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/passenger/bookings");

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load bookings");
      }

      const data: BookingRecord[] = await res.json();
      setBookings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load bookings");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  return (
    <section>
      <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-black)" }}>
        My Bookings
      </h2>

      {loading ? (
        <p style={{ color: "var(--awash-grey-dark)" }}>Loading bookings...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm" style={{ color: "var(--awash-error)" }}>
            {error}
          </p>
          <button
            onClick={fetchBookings}
            className="mt-2 text-sm font-medium underline"
            style={{ color: "var(--awash-error)" }}
          >
            Try again
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <p style={{ color: "var(--awash-grey-dark)" }}>
          No bookings yet. Search for a trip to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="p-4 transition"
              style={{
                background: "var(--awash-white)",
                borderRadius: "12px",
                borderTop: "4px solid var(--awash-orange)",
                boxShadow:
                  "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-3px)";
                e.currentTarget.style.boxShadow =
                  "0 12px 20px -4px rgba(0,0,0,0.15), 0 6px 8px -2px rgba(0,0,0,0.08)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 4px 6px -1px rgba(0,0,0,0.1), 0 2px 4px -1px rgba(0,0,0,0.06)";
              }}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold" style={{ color: "var(--awash-black)" }}>
                    {booking.trip.route.origin}{" "}
                    <span style={{ color: "var(--awash-grey-dark)" }}>&rarr;</span>{" "}
                    {booking.trip.route.destination}
                  </p>
                  <p
                    className="mt-1 font-mono text-sm"
                    style={{ color: "var(--awash-grey-dark)" }}
                  >
                    #{booking.id.slice(0, 8)}...
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={BOOKING_STATUS_STYLES[booking.status]}
                >
                  {booking.status}
                </span>
              </div>

              <div
                className="mt-3 pt-3"
                style={{ borderTop: "1px solid var(--awash-grey)" }}
              >
                <p className="font-medium" style={{ color: "var(--awash-black)" }}>
                  {booking.fullName}
                </p>
              </div>

              <div
                className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm"
                style={{ color: "var(--awash-grey-dark)" }}
              >
                <span>{formatDate(booking.trip.date)}</span>
                <span>{formatTime(booking.trip.departureTime)}</span>
                <span className="font-semibold" style={{ color: "var(--awash-black)" }}>
                  Seat {booking.seatNumber}
                </span>
                <span className="font-bold" style={{ color: "var(--awash-orange)" }}>
                  {booking.trip.price} ETB
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
