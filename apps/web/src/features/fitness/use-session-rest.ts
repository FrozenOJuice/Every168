"use client";
import { useCallback, useState } from "react";
type Rest = { until: number; exercise: string };
export function useSessionRest(userId: string, sessionId: string) {
  const key = `168hours:rest:${userId}:${sessionId}`;
  const [rest, setRest] = useState<Rest | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
      return value &&
        Number.isFinite(value.until) &&
        typeof value.exercise === "string"
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const startRest = useCallback(
    (seconds: number | null, exercise = "") => {
      const value =
        seconds && seconds > 0
          ? { until: Date.now() + seconds * 1000, exercise }
          : null;
      setRest(value);
      try {
        if (value) sessionStorage.setItem(key, JSON.stringify(value));
        else sessionStorage.removeItem(key);
      } catch {}
    },
    [key],
  );
  const clearRest = useCallback(() => startRest(null), [startRest]);
  return { rest, startRest, clearRest };
}
