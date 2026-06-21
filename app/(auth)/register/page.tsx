"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

interface RegisterForm {
  fullName: string;
  email: string;
  phone: string;
  password: string;
}

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState<RegisterForm>({
    fullName: "",
    email: "",
    phone: "",
    password: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.error ?? "Registration failed. Please try again.");
        return;
      }
      router.push("/login");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12" style={{ background: "var(--awash-black)" }}>
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold text-white">
            AWASH BUS{" "}
            <span style={{ color: "var(--awash-gold)" }}>አዋሽ ባስ</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--awash-grey-medium)" }}>
            Create your account to start booking
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 rounded-xl bg-white p-8 shadow-lg"
          style={{ borderLeft: "4px solid var(--awash-orange)" }}
        >
          {error && (
            <div className="rounded-md px-4 py-3 text-sm text-white" style={{ background: "var(--awash-error)" }}>
              {error}
            </div>
          )}

          <div>
            <label htmlFor="fullName" className="block text-sm font-medium" style={{ color: "var(--awash-charcoal)" }}>
              Full name
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              value={form.fullName}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ border: "1.5px solid var(--awash-grey-medium)", color: "var(--awash-black)" }}
              placeholder="Abebe Bekele"
            />
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium" style={{ color: "var(--awash-charcoal)" }}>
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ border: "1.5px solid var(--awash-grey-medium)", color: "var(--awash-black)" }}
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label htmlFor="phone" className="block text-sm font-medium" style={{ color: "var(--awash-charcoal)" }}>
              Phone
            </label>
            <input
              id="phone"
              name="phone"
              type="tel"
              required
              value={form.phone}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ border: "1.5px solid var(--awash-grey-medium)", color: "var(--awash-black)" }}
              placeholder="+251 9XX XXX XXX"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium" style={{ color: "var(--awash-charcoal)" }}>
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              className="mt-1 block w-full rounded-lg px-3 py-2 text-sm outline-none transition"
              style={{ border: "1.5px solid var(--awash-grey-medium)", color: "var(--awash-black)" }}
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            style={{ background: "var(--awash-orange)" }}
          >
            {loading ? "Creating account..." : "Create account"}
          </button>

          <p className="text-center text-sm" style={{ color: "var(--awash-grey-dark)" }}>
            Already have an account?{" "}
            <a href="/login" className="font-medium" style={{ color: "var(--awash-orange)" }}>
              Sign in
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}