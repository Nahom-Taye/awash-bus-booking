"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useSession, signOut } from "next-auth/react";
import SessionWarningModal from "@/app/components/SessionWarningModal";
import { useIdleTimer } from "@/app/hooks/useIdleTimer";

const WARNING_TIMEOUT = 120_000;
const LOGOUT_TIMEOUT = 180_000;

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
  createdAt: string;
  updatedAt: string;
}

type Tab = "routes" | "buses" | "trips" | "bookings";

const TABS: { key: Tab; label: string }[] = [
  { key: "routes", label: "Routes" },
  { key: "buses", label: "Buses" },
  { key: "trips", label: "Trips" },
  { key: "bookings", label: "Bookings" },
];

// --- Shared brand styling helpers (inline styles only handle the live value;
// pseudo-states like focus/hover are wired through small event handlers) ---

const formCardStyle: React.CSSProperties = {
  background: "var(--awash-white)",
  borderRadius: "12px",
  borderLeft: "4px solid var(--awash-orange)",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
};

const listCardStyle: React.CSSProperties = {
  background: "var(--awash-white)",
  borderRadius: "12px",
  borderTop: "4px solid var(--awash-orange)",
  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.08)",
};

const inputStyle: React.CSSProperties = {
  border: "1.5px solid #D6D6D6",
  color: "var(--awash-black)",
};

function handleInputFocus(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "var(--awash-blue)";
}

function handleInputBlur(e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) {
  e.currentTarget.style.borderColor = "#D6D6D6";
}

function handleSubmitHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "var(--awash-orange-dark)";
}

function handleSubmitLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "var(--awash-orange)";
}

const submitButtonStyle: React.CSSProperties = {
  background: "var(--awash-orange)",
};

// Hover lift handlers for list cards (translateY -3px + deeper shadow)
function handleCardHover(e: React.MouseEvent<HTMLLIElement>) {
  e.currentTarget.style.transform = "translateY(-3px)";
  e.currentTarget.style.boxShadow = "0 8px 20px rgba(0, 0, 0, 0.12)";
}

function handleCardLeave(e: React.MouseEvent<HTMLLIElement>) {
  e.currentTarget.style.transform = "translateY(0)";
  e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.08)";
}

export default function OperatorDashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("routes");
  const [showSessionWarning, setShowSessionWarning] = useState(false);
  const [sessionCountdown, setSessionCountdown] = useState(
    LOGOUT_TIMEOUT / 1_000,
  );

  const handleSessionLogout = useCallback(() => {
    void signOut({ callbackUrl: "/" });
  }, []);

  const { resetTimer } = useIdleTimer({
    warningTimeout: WARNING_TIMEOUT,
    logoutTimeout: LOGOUT_TIMEOUT,
    onWarning: () => {
      setSessionCountdown(LOGOUT_TIMEOUT / 1_000);
      setShowSessionWarning(true);
    },
    onLogout: handleSessionLogout,
  });

  useEffect(() => {
    if (!showSessionWarning) return;

    const countdownInterval = setInterval(() => {
      setSessionCountdown((current) => Math.max(0, current - 1));
    }, 1_000);

    return () => clearInterval(countdownInterval);
  }, [showSessionWarning]);

  const handleStayLoggedIn = () => {
    setShowSessionWarning(false);
    setSessionCountdown(LOGOUT_TIMEOUT / 1_000);
    resetTimer();
  };

  return (
    <div className="min-h-screen" style={{ background: "var(--awash-grey-light)" }}>
      {/* Top navbar */}
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

        <div className="flex items-center gap-3 sm:gap-4">
          <span className="hidden text-sm text-white sm:inline">
            {status === "loading"
              ? "Loading..."
              : session?.user?.fullName ?? "Guest"}
          </span>
          <button
            onClick={() => signOut({ callbackUrl: "/" })}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold text-white transition"
            style={submitButtonStyle}
            onMouseEnter={handleSubmitHover}
            onMouseLeave={handleSubmitLeave}
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* Tab navigation */}
      <nav
        className="sticky z-10 flex px-4 sm:px-8"
        style={{
          top: "64px",
          background: "var(--awash-white)",
          borderBottom: "1px solid #E8E8E8",
        }}
      >
        <div className="mx-auto flex w-full max-w-2xl gap-1">
          {TABS.map((tab) => {
            const active = activeTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="-mb-px border-b-2 px-4 py-3 text-sm font-medium transition"
                style={{
                  borderColor: active ? "var(--awash-orange)" : "transparent",
                  color: active ? "var(--awash-orange)" : "#6B6B6B",
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="px-4 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          {activeTab === "routes" && <RoutesTab />}
          {activeTab === "buses" && <BusesTab />}
          {activeTab === "trips" && <TripsTab />}
          {activeTab === "bookings" && <BookingsTab />}
        </div>
      </main>

      <SessionWarningModal
        isVisible={showSessionWarning}
        countdown={sessionCountdown}
        onStayLoggedIn={handleStayLoggedIn}
        onLogOut={handleSessionLogout}
      />
    </div>
  );
}

function RoutesTab() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchRoutes = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/operator/routes");

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load routes");
      }

      const data: Route[] = await res.json();
      setRoutes(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load routes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoutes();
  }, [fetchRoutes]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    if (!origin.trim() || !destination.trim()) {
      setFormError("Origin and destination are required");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/operator/routes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          origin: origin.trim(),
          destination: destination.trim(),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create route");
      }

      setOrigin("");
      setDestination("");
      await fetchRoutes();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create route");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-8 p-6" style={formCardStyle}>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
          Create a new route
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
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
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
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
              placeholder="Awash"
            />
          </div>
        </div>

        {formError && (
          <p className="mt-4 text-sm" style={{ color: "var(--awash-error)" }}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={submitButtonStyle}
          onMouseEnter={handleSubmitHover}
          onMouseLeave={handleSubmitLeave}
        >
          {submitting ? "Creating..." : "Create route"}
        </button>
      </form>

      <section>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
          Existing routes
        </h2>

        {loading ? (
          <p style={{ color: "var(--awash-grey-dark)" }}>Loading routes...</p>
        ) : error ? (
          <div className="rounded-lg p-4" style={{ background: "var(--awash-orange-bg)", border: "1px solid var(--awash-error)" }}>
            <p className="text-sm" style={{ color: "var(--awash-error)" }}>{error}</p>
            <button
              onClick={fetchRoutes}
              className="mt-2 text-sm font-medium underline"
              style={{ color: "var(--awash-error)" }}
            >
              Try again
            </button>
          </div>
        ) : routes.length === 0 ? (
          <p style={{ color: "var(--awash-grey-dark)" }}>No routes yet. Create one above.</p>
        ) : (
          <ul className="space-y-3">
            {routes.map((route) => (
              <li
                key={route.id}
                className="p-4 transition"
                style={listCardStyle}
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <p className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                  {route.origin}{" "}
                  <span style={{ color: "var(--awash-orange)" }}>&rarr;</span>{" "}
                  {route.destination}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function BusesTab() {
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [plateNumber, setPlateNumber] = useState("");
  const [totalSeats, setTotalSeats] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchBuses = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/operator/buses");

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load buses");
      }

      const data: Bus[] = await res.json();
      setBuses(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load buses");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBuses();
  }, [fetchBuses]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const seats = Number(totalSeats);

    if (!plateNumber.trim()) {
      setFormError("Plate number is required");
      return;
    }

    if (!Number.isInteger(seats) || seats < 1 || seats > 48) {
      setFormError("Total seats must be a whole number between 1 and 48");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/operator/buses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plateNumber: plateNumber.trim(),
          totalSeats: seats,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create bus");
      }

      setPlateNumber("");
      setTotalSeats("");
      await fetchBuses();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create bus");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-8 p-6" style={formCardStyle}>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
          Add a new bus
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="plate-number"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Plate number
            </label>
            <input
              id="plate-number"
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
              placeholder="AA-12345"
            />
          </div>

          <div>
            <label
              htmlFor="total-seats"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Total seats
            </label>
            <input
              id="total-seats"
              type="number"
              required
              min={1}
              max={48}
              value={totalSeats}
              onChange={(e) => setTotalSeats(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
              placeholder="48"
            />
          </div>
        </div>

        {formError && (
          <p className="mt-4 text-sm" style={{ color: "var(--awash-error)" }}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={submitButtonStyle}
          onMouseEnter={handleSubmitHover}
          onMouseLeave={handleSubmitLeave}
        >
          {submitting ? "Adding..." : "Add bus"}
        </button>
      </form>

      <section>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
          Existing buses
        </h2>

        {loading ? (
          <p style={{ color: "var(--awash-grey-dark)" }}>Loading buses...</p>
        ) : error ? (
          <div className="rounded-lg p-4" style={{ background: "var(--awash-orange-bg)", border: "1px solid var(--awash-error)" }}>
            <p className="text-sm" style={{ color: "var(--awash-error)" }}>{error}</p>
            <button
              onClick={fetchBuses}
              className="mt-2 text-sm font-medium underline"
              style={{ color: "var(--awash-error)" }}
            >
              Try again
            </button>
          </div>
        ) : buses.length === 0 ? (
          <p style={{ color: "var(--awash-grey-dark)" }}>No buses yet. Add one above.</p>
        ) : (
          <ul className="space-y-3">
            {buses.map((bus) => (
              <li
                key={bus.id}
                className="flex items-center justify-between p-4 transition"
                style={listCardStyle}
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div>
                  <p className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                    Plate {bus.plateNumber}
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-sm font-medium"
                  style={{ background: "var(--awash-blue-bg)", color: "var(--awash-blue)" }}
                >
                  {bus.totalSeats} seats
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

const STATUS_STYLES: Record<TripStatus, string> = {
  SCHEDULED: "bg-blue-100 text-blue-700",
  CANCELLED: "bg-red-100 text-red-700",
  COMPLETED: "bg-green-100 text-green-700",
};

// Brand badge colors for trip statuses (white text on solid brand backgrounds)
const TRIP_BADGE_STYLES: Record<TripStatus, React.CSSProperties> = {
  SCHEDULED: { background: "#1E3FA0", color: "#FFFFFF" },
  CANCELLED: { background: "#C0392B", color: "#FFFFFF" },
  COMPLETED: { background: "#27AE60", color: "#FFFFFF" },
};

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

function TripsTab() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [buses, setBuses] = useState<Bus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [routeId, setRouteId] = useState("");
  const [busId, setBusId] = useState("");
  const [date, setDate] = useState("");
  const [departureTime, setDepartureTime] = useState("");
  const [arrivalTime, setArrivalTime] = useState("");
  const [price, setPrice] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [tripsRes, routesRes, busesRes] = await Promise.all([
        fetch("/api/operator/trips"),
        fetch("/api/operator/routes"),
        fetch("/api/operator/buses"),
      ]);

      if (!tripsRes.ok || !routesRes.ok || !busesRes.ok) {
        const failed = [tripsRes, routesRes, busesRes].find((r) => !r.ok)!;
        const data = await failed.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load trips");
      }

      const [tripsData, routesData, busesData]: [Trip[], Route[], Bus[]] =
        await Promise.all([tripsRes.json(), routesRes.json(), busesRes.json()]);

      setTrips(tripsData);
      setRoutes(routesData);
      setBuses(busesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load trips");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFormError(null);

    const priceValue = Number(price);

    if (!routeId || !busId || !date || !departureTime || !arrivalTime) {
      setFormError("All fields are required");
      return;
    }

    if (!Number.isFinite(priceValue) || priceValue < 1) {
      setFormError("Price must be a number of at least 1");
      return;
    }

    const departureIso = new Date(`${date}T${departureTime}:00`).toISOString();
    const arrivalIso = new Date(`${date}T${arrivalTime}:00`).toISOString();
    const dateIso = `${date}T00:00:00.000Z`;

    if (
      Number.isNaN(new Date(departureIso).getTime()) ||
      Number.isNaN(new Date(arrivalIso).getTime())
    ) {
      setFormError("Invalid date or time");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch("/api/operator/trips", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          routeId,
          busId,
          date: dateIso,
          departureTime: departureIso,
          arrivalTime: arrivalIso,
          price: priceValue,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to create trip");
      }

      setRouteId("");
      setBusId("");
      setDate("");
      setDepartureTime("");
      setArrivalTime("");
      setPrice("");
      await fetchData();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Failed to create trip");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <form onSubmit={handleSubmit} className="mb-8 p-6" style={formCardStyle}>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
          Schedule a new trip
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="trip-route"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Route
            </label>
            <select
              id="trip-route"
              required
              value={routeId}
              onChange={(e) => setRouteId(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
            >
              <option value="" disabled>
                Select a route
              </option>
              {routes.map((route) => (
                <option key={route.id} value={route.id}>
                  {route.origin} → {route.destination}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="trip-bus"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Bus
            </label>
            <select
              id="trip-bus"
              required
              value={busId}
              onChange={(e) => setBusId(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
            >
              <option value="" disabled>
                Select a bus
              </option>
              {buses.map((bus) => (
                <option key={bus.id} value={bus.id}>
                  {bus.plateNumber}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="trip-date"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Date
            </label>
            <input
              id="trip-date"
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="trip-price"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Price
            </label>
            <input
              id="trip-price"
              type="number"
              required
              min={1}
              step="0.01"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
              placeholder="500"
            />
          </div>

          <div>
            <label
              htmlFor="trip-departure"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Departure time
            </label>
            <input
              id="trip-departure"
              type="time"
              required
              value={departureTime}
              onChange={(e) => setDepartureTime(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
            />
          </div>

          <div>
            <label
              htmlFor="trip-arrival"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Arrival time
            </label>
            <input
              id="trip-arrival"
              type="time"
              required
              value={arrivalTime}
              onChange={(e) => setArrivalTime(e.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              className="w-full rounded-lg px-3 py-2 outline-none transition"
              style={inputStyle}
            />
          </div>
        </div>

        {formError && (
          <p className="mt-4 text-sm" style={{ color: "var(--awash-error)" }}>
            {formError}
          </p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50"
          style={submitButtonStyle}
          onMouseEnter={handleSubmitHover}
          onMouseLeave={handleSubmitLeave}
        >
          {submitting ? "Scheduling..." : "Schedule trip"}
        </button>
      </form>

      <section>
        <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
          Existing trips
        </h2>

        {loading ? (
          <p style={{ color: "var(--awash-grey-dark)" }}>Loading trips...</p>
        ) : error ? (
          <div className="rounded-lg p-4" style={{ background: "var(--awash-orange-bg)", border: "1px solid var(--awash-error)" }}>
            <p className="text-sm" style={{ color: "var(--awash-error)" }}>{error}</p>
            <button
              onClick={fetchData}
              className="mt-2 text-sm font-medium underline"
              style={{ color: "var(--awash-error)" }}
            >
              Try again
            </button>
          </div>
        ) : trips.length === 0 ? (
          <p style={{ color: "var(--awash-grey-dark)" }}>No trips yet. Schedule one above.</p>
        ) : (
          <ul className="space-y-3">
            {trips.map((trip) => (
              <li
                key={trip.id}
                className="p-4 transition"
                style={listCardStyle}
                onMouseEnter={handleCardHover}
                onMouseLeave={handleCardLeave}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                      {trip.route.origin}{" "}
                      <span style={{ color: "var(--awash-orange)" }}>&rarr;</span>{" "}
                      {trip.route.destination}
                    </p>
                    <p className="mt-1 text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                      Bus {trip.bus.plateNumber}
                    </p>
                  </div>
                  <span
                    className="rounded-full px-3 py-1 text-xs font-semibold"
                    style={TRIP_BADGE_STYLES[trip.status]}
                  >
                    {trip.status}
                  </span>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                  <span>{formatDate(trip.date)}</span>
                  <span>
                    {formatTime(trip.departureTime)} &ndash;{" "}
                    {formatTime(trip.arrivalTime)}
                  </span>
                  <span className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                    {trip.price} ETB
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type BookingStatus = "PENDING" | "CONFIRMED" | "CANCELLED";

interface BookingItem {
  id: string;
  seatNumber: number;
  status: BookingStatus;
  fullName: string;
  phone: string;
  createdAt: string;
  trip: {
    date: string;
    departureTime: string;
    route: {
      origin: string;
      destination: string;
    };
  };
}

const BOOKING_STATUS_STYLES: Record<BookingStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-700",
  CONFIRMED: "bg-green-100 text-green-700",
  CANCELLED: "bg-red-100 text-red-700",
};

// Brand badge colors for booking statuses (white text on solid brand backgrounds)
const BOOKING_BADGE_STYLES: Record<BookingStatus, React.CSSProperties> = {
  PENDING: { background: "#F39C12", color: "#FFFFFF" },
  CONFIRMED: { background: "#27AE60", color: "#FFFFFF" },
  CANCELLED: { background: "#C0392B", color: "#FFFFFF" },
};

function BookingsTab() {
  const [bookings, setBookings] = useState<BookingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/operator/bookings");

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Failed to load bookings");
      }

      const data: BookingItem[] = await res.json();
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
      <h2 className="mb-4 text-lg font-bold" style={{ color: "var(--awash-charcoal)" }}>
        Bookings
      </h2>

      {loading ? (
        <p style={{ color: "var(--awash-grey-dark)" }}>Loading bookings...</p>
      ) : error ? (
        <div className="rounded-lg p-4" style={{ background: "var(--awash-orange-bg)", border: "1px solid var(--awash-error)" }}>
          <p className="text-sm" style={{ color: "var(--awash-error)" }}>{error}</p>
          <button
            onClick={fetchBookings}
            className="mt-2 text-sm font-medium underline"
            style={{ color: "var(--awash-error)" }}
          >
            Try again
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <p style={{ color: "var(--awash-grey-dark)" }}>No bookings yet.</p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((booking) => (
            <li
              key={booking.id}
              className="p-4 transition"
              style={listCardStyle}
              onMouseEnter={handleCardHover}
              onMouseLeave={handleCardLeave}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                    {booking.trip.route.origin}{" "}
                    <span style={{ color: "var(--awash-orange)" }}>&rarr;</span>{" "}
                    {booking.trip.route.destination}
                  </p>
                  <p className="mt-1 text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                    #{booking.id.slice(0, 8)}...
                  </p>
                </div>
                <span
                  className="rounded-full px-3 py-1 text-xs font-semibold"
                  style={BOOKING_BADGE_STYLES[booking.status]}
                >
                  {booking.status}
                </span>
              </div>

              <div className="mt-3 pt-3" style={{ borderTop: "1px solid #E8E8E8" }}>
                <p className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                  {booking.fullName}
                </p>
                <p className="text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                  {booking.phone}
                </p>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm" style={{ color: "var(--awash-grey-dark)" }}>
                <span>{formatDate(booking.trip.date)}</span>
                <span>{formatTime(booking.trip.departureTime)}</span>
                <span className="font-semibold" style={{ color: "var(--awash-charcoal)" }}>
                  Seat {booking.seatNumber}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
