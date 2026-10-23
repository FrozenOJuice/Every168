"use client";
import { createContext, useContext, useState, type ReactNode } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { dateSchema } from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { useMe } from "@/features/identity/me";

const Context = createContext<{
  date: string;
  selectDate: (date: string) => void;
} | null>(null);
export function DomainDayProvider({ children }: { children: ReactNode }) {
  const {
    preferences: { timezone },
  } = useMe();
  const params = useSearchParams();
  const path = usePathname();
  const router = useRouter();
  const [selected, setSelected] = useState(() =>
    localDate(new Date(), timezone),
  );
  const parsed = dateSchema.safeParse(params.get("date"));
  const explicit = parsed.success ? parsed.data : null;
  // Remember an explicit date when the next domain's URL omits it.
  if (explicit && explicit !== selected) setSelected(explicit);
  return (
    <Context.Provider
      value={{
        date: explicit ?? selected,
        selectDate: (date) => {
          if (!dateSchema.safeParse(date).success) return;
          const query = new URLSearchParams(params.toString());
          query.set("date", date);
          router.push(`${path}?${query}`);
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useDomainDay() {
  const value = useContext(Context);
  if (!value)
    throw new Error("Domain day requires the authenticated workspace.");
  return value;
}
