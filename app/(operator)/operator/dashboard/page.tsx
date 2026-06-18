"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
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

type Tab = "routes" | "buses" | "trips";

const TABS: { key: Tab; label: string }[] = [
  { key: "routes", label: "Routes" },
  { key: "buses", label: "Buses" },
  { key: "trips", label: "Trips" },
];

export default function OperatorDashboardPage() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("routes");

  return (
    <div className="min-h-screen bg-gray-50 px-4 py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">
            Operator Dashboard
          </h1>
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

        {activeTab === "routes" && <RoutesTab />}
        {activeTab === "buses" && <BusesTab />}
        {activeTab === "trips" && <TripsTab />}
      </div>
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
      <form
        onSubmit={handleSubmit}
        className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Create a new route
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
        </div>

        {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Creating..." : "Create route"}
        </button>
      </form>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Existing routes
        </h2>

        {loading ? (
          <p className="text-gray-600">Loading routes...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchRoutes}
              className="mt-2 text-sm font-medium text-red-700 underline"
            >
              Try again
            </button>
          </div>
        ) : routes.length === 0 ? (
          <p className="text-gray-600">No routes yet. Create one above.</p>
        ) : (
          <ul className="space-y-3">
            {routes.map((route) => (
              <li
                key={route.id}
                className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <p className="font-medium text-gray-900">
                  {route.origin}{" "}
                  <span className="text-gray-400">&rarr;</span>{" "}
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
      <form
        onSubmit={handleSubmit}
        className="mb-8 rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
      >
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Add a new bus
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label
              htmlFor="plate-number"
              className="mb-1 block text-sm font-medium text-gray-700"
            >
              Plate number
            </label>
            <input
              id="plate-number"
              type="text"
              required
              value={plateNumber}
              onChange={(e) => setPlateNumber(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="AA-12345"
            />
          </div>

          <div>
            <label
              htmlFor="total-seats"
              className="mb-1 block text-sm font-medium text-gray-700"
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
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-gray-900 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="48"
            />
          </div>
        </div>

        {formError && <p className="mt-4 text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-4 rounded-lg bg-gray-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Adding..." : "Add bus"}
        </button>
      </form>

      <section>
        <h2 className="mb-4 text-lg font-semibold text-gray-900">
          Existing buses
        </h2>

        {loading ? (
          <p className="text-gray-600">Loading buses...</p>
        ) : error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 p-4">
            <p className="text-sm text-red-600">{error}</p>
            <button
              onClick={fetchBuses}
              className="mt-2 text-sm font-medium text-red-700 underline"
            >
              Try again
            </button>
          </div>
        ) : buses.length === 0 ? (
          <p className="text-gray-600">No buses yet. Add one above.</p>
        ) : (
          <ul className="space-y-3">
            {buses.map((bus) => (
              <li
                key={bus.id}
                className="flex items-center justify-between rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
              >
                <div>
                  <p className="font-medium text-gray-900">
                    Plate {bus.plateNumber}
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 px-3 py-1 text-sm font-medium text-gray-700">
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

function TripsTab() {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <p className="text-gray-600">Trips management coming soon</p>
    </div>
  );
}