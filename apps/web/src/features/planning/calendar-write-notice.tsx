"use client";
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useMe } from "@/features/identity/me";
import {
  pendingCalendarWrite,
  retryCalendarWrite,
  setCalendarWriteOwner,
} from "./calendar-write-recovery";
export function CalendarWriteNotice() {
  const { user } = useMe();
  const cache = useQueryClient();
  const [pending, setPending] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setCalendarWriteOwner(user.id);
    try {
      // Read the owner-scoped external journal after hydration.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setPending(!!pendingCalendarWrite());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [user.id]);
  if (!pending && !error) return null;
  return (
    <div role="alert" className="notice">
      <p>{error ?? "A previous Calendar change still needs confirmation."}</p>
      {pending && (
        <button
          className="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await retryCalendarWrite();
              setPending(false);
              setError(null);
              await cache.invalidateQueries();
            } catch (e) {
              setError((e as Error).message);
              setPending(!!pendingCalendarWrite());
            } finally {
              setBusy(false);
            }
          }}
        >
          Retry same change
        </button>
      )}
    </div>
  );
}
