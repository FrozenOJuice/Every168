"use client";
import { useEffect, useState } from "react";
export function RestTimer({
  until,
  onCancel,
}: {
  until: number | null;
  onCancel: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!until) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [until]);
  if (!until) return null;
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));
  return (
    <div className="fitness-rest" role="timer" aria-label="Rest timer">
      <strong>
        {remaining
          ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, "0")} rest remaining`
          : "Rest finished"}
      </strong>
      <button className="button" onClick={onCancel}>
        Dismiss timer
      </button>
    </div>
  );
}
