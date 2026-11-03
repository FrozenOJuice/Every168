"use client";
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CalendarScrollPosition } from "./calendar-grid";
import { parseCalendarReturn } from "./calendar-return";

type Position = CalendarScrollPosition & {
  hourHeight: number;
  dayTop?: number;
  feedTop?: number;
};
type Visit = {
  href: string;
  position?: Position;
  location: string;
  entryKey?: string;
  entryIndex?: number;
};
type CalendarVisit = {
  href?: string;
  get: () => Visit | undefined;
  remember: (href: string, position?: Position) => void;
};
const Context = createContext<CalendarVisit | null>(null);

/** Mounted per account: leaving the document or signing out clears this memory. */
export function CalendarVisitProvider({ children }: { children: ReactNode }) {
  const visit = useRef<Visit | undefined>(undefined);
  const [href, setHref] = useState<string>();
  const get = useCallback(() => visit.current, []);
  const remember = useCallback((value: string, position?: Position) => {
    const href = parseCalendarReturn(value);
    if (!href || window.location.pathname !== "/") return;
    const previous = visit.current;
    visit.current = {
      href,
      position:
        position ?? (previous?.href === href ? previous.position : undefined),
      location: window.location.pathname + window.location.search,
      entryKey: window.navigation?.currentEntry?.key,
      entryIndex:
        typeof window.history.state?.__168hoursIndex === "number"
          ? window.history.state.__168hoursIndex
          : undefined,
    };
    setHref(href);
  }, []);
  const value = useMemo(() => ({ href, get, remember }), [href, get, remember]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useCalendarVisit() {
  const value = useContext(Context);
  if (!value) throw new Error("CalendarVisitProvider required");
  return value;
}
