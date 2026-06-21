import Link from "next/link";

const STEPS = [
  {
    title: "Search for a trip",
    description: "Select your origin, destination, and travel date.",
  },
  {
    title: "Choose your seat",
    description:
      "View available trips and pick your preferred seat from the seat map.",
  },
  {
    title: "Get your ticket",
    description:
      "Confirm your booking and receive your digital ticket instantly.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-4">
          <span className="text-lg font-bold text-gray-900">Awash Bus</span>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero */}
        <section className="mx-auto w-full max-w-5xl px-6 py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-5xl">
              Book bus tickets across Ethiopia quickly, safely, and
              conveniently.
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600">
              Search available trips, choose your seat, and confirm your booking
              in minutes.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link
                href="/passenger/dashboard"
                className="w-full rounded-lg bg-gray-900 px-6 py-3 text-center text-sm font-medium text-white transition hover:bg-gray-800 sm:w-auto"
              >
                Search Trips
              </Link>
            </div>
          </div>
        </section>

        {/* How it works */}
        <section className="border-t border-gray-200 bg-white">
          <div className="mx-auto w-full max-w-5xl px-6 py-20">
            <h2 className="text-center text-2xl font-bold text-gray-900 sm:text-3xl">
              How it works
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-center text-gray-600">
              Booking your next trip takes just three simple steps.
            </p>

            <div className="mt-12 grid gap-6 sm:grid-cols-3">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-gray-200 bg-gray-50 p-6"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-900 text-sm font-semibold text-white">
                    {index + 1}
                  </span>
                  <h3 className="mt-4 text-lg font-semibold text-gray-900">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-gray-600">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto w-full max-w-5xl px-6 py-8">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              © 2026 Awash Bus. All rights reserved.
            </p>
            <Link
              href="/login"
              className="text-sm text-gray-400 transition hover:text-gray-600"
            >
              Operator Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}