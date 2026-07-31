"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  destinationsForOrigin,
  uniqueOrigins,
  type ServedCity,
  type ServedRoute,
} from "@/lib/served-routes";

export type { ServedCity, ServedRoute } from "@/lib/served-routes";

export function servedCityLabel(city: ServedCity, locale: string): string {
  return locale === "am" ? city.am : city.en;
}

export function useServedRoutes() {
  const [routes, setRoutes] = useState<ServedRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadRoutes() {
      setLoading(true);
      setError(false);

      try {
        const response = await fetch("/api/routes/served", {
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("LOAD_SERVED_ROUTES_FAILED");
        const data = (await response.json()) as { routes?: ServedRoute[] };
        setRoutes(Array.isArray(data.routes) ? data.routes : []);
      } catch (loadError) {
        if (
          loadError instanceof DOMException &&
          loadError.name === "AbortError"
        ) {
          return;
        }
        setError(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadRoutes();
    return () => controller.abort();
  }, []);

  const origins = useMemo(() => {
    return uniqueOrigins(routes);
  }, [routes]);

  const destinationsFor = useCallback(
    (origin: string): ServedCity[] =>
      destinationsForOrigin(routes, origin),
    [routes],
  );

  return { routes, origins, destinationsFor, loading, error };
}
