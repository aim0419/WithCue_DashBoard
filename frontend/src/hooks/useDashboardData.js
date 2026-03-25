import { useEffect, useState } from "react";
import { getDashboardData } from "../lib/dashboard-service.js";

export function useDashboardData() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      // App에서는 단순한 상태만 받도록 훅 내부에서 로딩과 취소 처리를 함께 감싼다.
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
  }, []);

  return { data, loading };
}
