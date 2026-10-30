"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ExerciseDraft } from "./strength-draft";
import {
  nextSessionRest,
  reconcileSessionRest,
  undoSessionRest,
  type RestSource,
  type SessionRest,
} from "./session-rest-state";
export function useSessionRest(
  userId: string,
  sessionId: string,
  exercises: ExerciseDraft[],
) {
  const key = `168hours:rest:${userId}:${sessionId}`;
  const [rest, setRest] = useState<SessionRest | null>(() => {
    try {
      const value = JSON.parse(sessionStorage.getItem(key) ?? "null");
      const keys = (v: unknown) =>
        Array.isArray(v) &&
        v.length > 0 &&
        v.every((k) => typeof k === "string");
      return value &&
        Number.isFinite(value.until) &&
        Number.isFinite(value.startedAt) &&
        Number.isFinite(value.durationSeconds) &&
        value.durationSeconds > 0 &&
        typeof value.exercise === "string" &&
        keys(value.source?.exerciseKeys) &&
        keys(value.source?.setKeys)
        ? value
        : null;
    } catch {
      return null;
    }
  });
  const current = useRef(rest);
  const commit = useCallback(
    (value: SessionRest | null) => {
      current.current = value;
      setRest(value);
      try {
        if (value) sessionStorage.setItem(key, JSON.stringify(value));
        else sessionStorage.removeItem(key);
      } catch {}
    },
    [key],
  );
  const startRest = useCallback(
    (seconds: number | null, exercise: string, source: RestSource) => {
      commit(
        nextSessionRest(current.current, seconds, exercise, source, Date.now()),
      );
    },
    [commit],
  );
  const cancelSetRest = useCallback(
    (source: RestSource) => {
      commit(undoSessionRest(current.current, source));
    },
    [commit],
  );
  const clearRest = useCallback(() => commit(null), [commit]);
  useEffect(() => {
    const next = reconcileSessionRest(current.current, exercises);
    if (next !== current.current) commit(next);
  }, [exercises, commit]);
  return { rest, startRest, clearRest, cancelSetRest };
}
