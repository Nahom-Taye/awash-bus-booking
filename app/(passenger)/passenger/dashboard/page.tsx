"use client";

import { useSession } from "next-auth/react";

export default function PassengerDashboardPage() {
  const { data: session, status } = useSession();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-2xl font-bold text-gray-900">
          Welcome, Passenger Dashboard
        </h1>
        <p className="mt-3 text-gray-600">
          {status === "loading"
            ? "Loading..."
            : `Signed in as ${session?.user?.fullName ?? "Guest"}`}
        </p>
      </div>
    </div>
  );
}
