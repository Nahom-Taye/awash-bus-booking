import Link from "next/link";
import SearchWidget from "@/app/components/SearchWidget";

const FEATURES = [
  {
    title: "Safe & Reliable",
    description:
      "Vetted operators and well-maintained buses keep every journey secure.",
  },
  {
    title: "Comfortable Seats",
    description:
      "Spacious, reclining seats designed for long-distance travel in comfort.",
  },
  {
    title: "On-Time Departures",
    description:
      "Punctual schedules you can count on, so you arrive when you plan to.",
  },
  {
    title: "Easy Online Booking",
    description:
      "Search, pick your seat, and confirm your ticket in just a few minutes.",
  },
];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col bg-awash-white font-sans">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 flex h-16 w-full items-center justify-between bg-awash-black px-6">
        <span className="text-lg font-bold text-white">
          AWASH BUS <span className="text-awash-grey-medium">|</span>{" "}
          <span className="text-awash-gold">አዋሽ ባስ</span>
        </span>
        <div className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-lg border border-white px-4 py-2 text-sm font-medium text-white transition hover:bg-white hover:text-awash-black"
          >
            Login
          </Link>
          <Link
            href="/register"
            className="rounded-lg bg-awash-gold px-4 py-2 text-sm font-semibold text-awash-black transition hover:brightness-95"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <section
        className="relative flex min-h-[calc(100vh-64px)] flex-col items-center justify-center px-6 py-20"
        style={{
          background:
            "linear-gradient(135deg, var(--awash-orange) 0%, var(--awash-orange-light) 45%, var(--awash-white) 100%)",
        }}
      >
        <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
          <h1 className="text-4xl font-bold leading-tight tracking-tight text-white sm:text-5xl md:text-6xl">
            Travel Ethiopia with Comfort &amp; Safety
          </h1>
          <p className="mt-4 text-2xl font-semibold text-white sm:text-3xl">
            በምቾትና በደህንነት ይጓዙ
          </p>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-white/90">
            Book your seat online – Addis Ababa to 15+ destinations
          </p>

          <SearchWidget />
        </div>

        {/* Diagonal white shape at bottom of hero */}
        <div
          aria-hidden
          className="absolute bottom-0 left-0 z-0 h-24 w-full bg-awash-white"
          style={{ clipPath: "polygon(0 100%, 100% 30%, 100% 100%)" }}
        />
      </section>

      {/* WHY CHOOSE US */}
      <section className="bg-awash-grey-light px-6 py-20">
        <div className="mx-auto w-full max-w-6xl">
          <h2 className="text-center text-3xl font-bold text-awash-black">
            Why Choose Us
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-center text-awash-grey-dark">
            Everything you need for a smooth journey across Ethiopia.
          </p>

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.title}
                className="rounded-xl border-t-4 border-awash-orange bg-awash-white p-6 shadow-sm"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-awash-orange text-sm font-bold text-white">
                  {index + 1}
                </span>
                <h3 className="mt-4 text-lg font-semibold text-awash-black">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-awash-grey-dark">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t-4 border-awash-orange bg-awash-black">
        <div className="mx-auto w-full max-w-6xl px-6 py-12">
          <div className="flex flex-col justify-between gap-8 sm:flex-row">
            <div className="max-w-sm">
              <p className="text-lg font-bold text-white">
                AWASH BUS{" "}
                <span className="text-awash-gold">አዋሽ ባስ</span>
              </p>
              <p className="mt-3 text-sm leading-6 text-awash-grey-medium">
                Book bus tickets across Ethiopia quickly, safely, and
                conveniently. Addis Ababa to 15+ destinations.
              </p>
            </div>

            <div>
              <h4 className="text-sm font-semibold uppercase tracking-wide text-white">
                Quick Links
              </h4>
              <ul className="mt-4 space-y-2 text-sm">
                <li>
                  <Link
                    href="/"
                    className="text-awash-grey-medium transition hover:text-white"
                  >
                    Home
                  </Link>
                </li>
                <li>
                  <Link
                    href="/passenger/dashboard"
                    className="text-awash-grey-medium transition hover:text-white"
                  >
                    Book Now
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-awash-grey-medium transition hover:text-white"
                  >
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
          </div>

          <div className="mt-10 flex flex-col items-center justify-between gap-3 border-t border-awash-charcoal pt-6 sm:flex-row">
            <p className="text-sm text-awash-grey-medium">
              © 2026 Awash Bus. All rights reserved.
            </p>
            <Link
              href="/login"
              className="text-sm text-awash-grey-dark transition hover:text-awash-grey-medium"
            >
              Operator Login
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}