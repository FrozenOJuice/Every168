import { useEffect, useState } from "react";

export function useCalendarClock(initial: string) {
  const [now, setNow] = useState(initial);
  useEffect(() => {
    const refresh = () => setNow(new Date().toISOString());
    const frame = requestAnimationFrame(refresh);
    const timer = setInterval(refresh, 60000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  return now;
}
