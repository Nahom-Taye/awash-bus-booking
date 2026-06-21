"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSession } from "next-auth/react";

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
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Find a trip</h1>
          <p className="mt-1 text-gray-600">
            {status === "loading"
              ? "Loading..."
              : `Signed in as ${session?.user?.fullName ?? "Guest"}`}
          </p>
        </header>

        <nav className="mb-8 flex gap-1 border-b border-gray-200">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "border-gray-900 text-gray-900"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === "search" && (
          <>
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <h2 className="mb-4 text-lg font-semibold text-gray-900">
            Search available trips
          </h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label
                htmlFor="origin"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Origin
              </label>
              <input
                id="origin"
                type="text"
                required
                value={origin}
                onChange={(e) => setOrigin(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="Addis Ababa"
              />
            </div>

            <div>
              <label
                htmlFor="destination"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Destination
              </label>
              <input
                id="destination"
                type="text"
                required
                value={destination}
                onChange={(e) => setDestination(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
                placeholder="Awash"
              />
            </div>

            <div>
              <label
                htmlFor="date"
                className="mb-1 block text-sm font-medium text-gray-700"
              >
                Date
              </label>
              <input
                id="date"
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
            </div>
          </div>

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </form>

        <section>
          {loading ? (
            <p className="text-gray-600">Searching trips...</p>
          ) : trips === null ? (
            <p className="text-gray-600">
              Enter your trip details above to search.
            </p>
          ) : trips.length === 0 ? (
            <p className="text-gray-600">No trips found.</p>
          ) : (
            <ul className="space-y-3">
              {trips.map((trip) => {
                const availableSeats =
                  trip.bus.totalSeats - trip._count.bookings;
                const soldOut = availableSeats <= 0;

                return (
                  <li
                    key={trip.id}
                    className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-gray-900">
                          {trip.route.origin}{" "}
                          <span className="text-gray-400">&rarr;</span>{" "}
                          {trip.route.destination}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          Bus {trip.bus.plateNumber}
                        </p>
                      </div>
                      <span className="font-medium text-gray-900">
                        {trip.price} ETB
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                      <span>
                        {formatTime(trip.departureTime)} &ndash;{" "}
                        {formatTime(trip.arrivalTime)}
                      </span>
                      <span
                        className={
                          soldOut
                            ? "font-medium text-red-600"
                            : "font-medium text-green-700"
                        }
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
                          className="rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Book Now
                        </button>
                      ) : (
                        <Link
                          href={`/passenger/booking/${trip.id}`}
                          className="inline-block rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800"
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

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
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
      <h2 className="mb-4 text-lg font-semibold text-gray-900">My bookings</h2>

      {loading ? (
        <p className="text-gray-600">Loading bookings...</p>
      ) : error ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={fetchBookings}
            className="mt-2 text-sm font-medium text-red-700 underline"
          >
            Try again
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <p className="text-gray-600">
          No bookings yet. Search for a trip to get started.
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-gray-900">
                    {booking.trip.route.origin}{" "}
                    <span className="text-gray-400">&rarr;</span>{" "}
                    {booking.trip.route.destination}
                  </p>
                  <p className="mt-1 text-sm text-gray-500">
                    #{booking.id.slice(0, 8)}...
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${BOOKING_STATUS_STYLES[booking.status]}`}
                >
                  {booking.status}
                </span>
              </div>

              <div className="mt-3 border-t border-gray-100 pt-3">
                <p className="font-medium text-gray-900">{booking.fullName}</p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
                <span>{formatDate(booking.trip.date)}</span>
                <span>{formatTime(booking.trip.departureTime)}</span>
                <span className="font-medium text-gray-900">
                  Seat {booking.seatNumber}
                </span>
                <span className="font-medium text-gray-900">
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
