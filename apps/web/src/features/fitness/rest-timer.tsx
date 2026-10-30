"use client";
import { useEffect, useState } from "react";
export function RestTimer({
  until,
  onCancel,
  label,
  pausedAt,
}: {
  until: number | null;
  onCancel: () => void;
  label?: string;
  pausedAt?: number | null;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until || pausedAt) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [until, pausedAt]);
  if (!until) return null;
  const remaining = Math.max(0, Math.ceil((until - (pausedAt ?? now)) / 1000));
  return (
    <div className="fitness-rest" role="timer" aria-label="Rest timer">
      <div className="fitness-rest-copy">
        {label && <span>{label}</span>}
        <strong>
          {remaining
            ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} rest remaining`
            : "Rest finished"}
        </strong>
      </div>
      <button className="button" onClick={onCancel}>
        {remaining ? "Skip rest" : "Dismiss timer"}
      </button>
    </div>
  );
}
