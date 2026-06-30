"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn, getSession } from "next-auth/react";

interface LoginForm {
  email: string;
  password: string;
}

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState<LoginForm>({ email: "", password: "" });
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
      const res = await signIn("credentials", {
        email: form.email,
        password: form.password,
        redirect: false,
      });

      if (!res || res.error) {
        setError("Invalid email or password");
        return;
      }

      const session = await getSession();
      const role = session?.user?.role;

      if (role === "OPERATOR") {
        router.push("/operator/dashboard");
      } else if (role === "PASSENGER") {
        const saved = sessionStorage.getItem("awash_search");
        if (saved) {
          const { origin, destination, date } = JSON.parse(saved);
          sessionStorage.removeItem("awash_search");
          const query = new URLSearchParams({ origin, destination, date });
          router.push(`/passenger/dashboard?${query.toString()}`);
        } else {
          router.push("/passenger/dashboard");
        }
      } else {
        router.push("/");
      }
    } catch {
      setError("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="flex min-h-screen items-center justify-center px-4 py-12"
      style={{ background: "var(--awash-black)" }}
    >
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold">
            <span style={{ color: "var(--awash-white)" }}>AWASH BUS | </span>
            <span style={{ color: "var(--awash-gold)" }}>አዋሽ ባስ</span>
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--awash-grey-medium)" }}>
            Sign in to your account
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-5 p-8"
          style={{
            background: "var(--awash-white)",
            borderRadius: "12px",
            boxShadow:
              "0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 10px 10px -5px rgba(0, 0, 0, 0.2)",
            borderLeft: "4px solid var(--awash-orange)",
          }}
        >
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              value={form.email}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 focus:outline-none"
              style={{
                border: "1.5px solid var(--awash-grey-medium)",
                borderRadius: "8px",
                color: "var(--awash-charcoal)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = "1.5px solid var(--awash-blue)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.border =
                  "1.5px solid var(--awash-grey-medium)")
              }
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium"
              style={{ color: "var(--awash-charcoal)" }}
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              value={form.password}
              onChange={handleChange}
              className="mt-1 block w-full px-3 py-2 focus:outline-none"
              style={{
                border: "1.5px solid var(--awash-grey-medium)",
                borderRadius: "8px",
                color: "var(--awash-charcoal)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.border = "1.5px solid var(--awash-blue)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.border =
                  "1.5px solid var(--awash-grey-medium)")
              }
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center text-sm font-semibold transition focus:outline-none disabled:cursor-not-allowed disabled:opacity-60"
            style={{
              background: "var(--awash-orange)",
              color: "var(--awash-white)",
              borderRadius: "8px",
              padding: "12px",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--awash-orange-dark)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "var(--awash-orange)")
            }
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>

          <p className="text-center text-sm" style={{ color: "var(--awash-grey-dark)" }}>
            New to Awash Bus?{" "}
            
              <a href="/register"
              className="font-medium"
              style={{ color: "var(--awash-orange)" }}
            >
              Create an account
            </a>
          </p>
        </form>
      </div>
    </div>
  );
}