import { useCallback, useEffect, useState } from "react";
import { getDashboardData } from "../lib/dashboard-service.js";

export function useDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const nextData = await getDashboardData();
    setData(nextData);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const nextData = await getDashboardData();

      if (!cancelled) {
        setData(nextData);
        setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, [refresh]);

  return { data, loading, refresh };
}
