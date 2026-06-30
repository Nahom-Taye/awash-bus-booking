"use client";

import { useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";

const CITIES = [
  "Addis Ababa",
  "Hawassa",
  "Gondar",
  "Dessie",
  "Dire Dawa",
  "Arba Minch",
  "Dilla",
  "Bule Hora",
  "Yirga Cheffe",
];

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

function handleButtonHover(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "var(--awash-orange-dark)";
}

function handleButtonLeave(e: React.MouseEvent<HTMLButtonElement>) {
  e.currentTarget.style.background = "var(--awash-orange)";
}

export default function SearchWidget() {
  const { status } = useSession();
  const router = useRouter();

  const [origin, setOrigin] = useState("Addis Ababa");
  const [destination, setDestination] = useState("Hawassa");
  const [date, setDate] = useState("");

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    sessionStorage.setItem(
      "awash_search",
      JSON.stringify({ origin, destination, date })
    );

    if (status === "authenticated") {
      const query = new URLSearchParams({ origin, destination, date });
      router.push(`/passenger/dashboard?${query.toString()}`);
    } else {
      router.push("/login");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto mt-10 w-full max-w-3xl p-6 text-left"
      style={{
        background: "var(--awash-white)",
        borderRadius: "12px",
        boxShadow: "0 20px 40px rgba(0, 0, 0, 0.2)",
      }}
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex flex-col">
          <label
            htmlFor="from"
            className="mb-1 text-sm font-medium"
            style={{ color: "var(--awash-charcoal)" }}
          >
            From
          </label>
          <select
            id="from"
            name="origin"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="rounded-lg px-3 py-2 outline-none transition"
            style={inputStyle}
          >
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label
            htmlFor="to"
            className="mb-1 text-sm font-medium"
            style={{ color: "var(--awash-charcoal)" }}
          >
            To
          </label>
          <select
            id="to"
            name="destination"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="rounded-lg px-3 py-2 outline-none transition"
            style={inputStyle}
          >
            {CITIES.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col">
          <label
            htmlFor="date"
            className="mb-1 text-sm font-medium"
            style={{ color: "var(--awash-charcoal)" }}
          >
            Date
          </label>
          <input
            id="date"
            name="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            onFocus={handleInputFocus}
            onBlur={handleInputBlur}
            className="rounded-lg px-3 py-2 outline-none transition"
            style={inputStyle}
          />
        </div>

        <div className="flex flex-col justify-end">
          <button
            type="submit"
            className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white transition"
            style={{ background: "var(--awash-orange)" }}
            onMouseEnter={handleButtonHover}
            onMouseLeave={handleButtonLeave}
          >
            Search Buses
          </button>
        </div>
      </div>
    </form>
  );
}
