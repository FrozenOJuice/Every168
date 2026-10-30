"use client";
import { useConfirm } from "@/components/ui/confirmation-provider";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { NutritionTotals } from "@168hours/contracts";
import { Dialog } from "@/components/ui/dialog";
import { FormBusyContext } from "@/components/ui/form";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { number } from "@/lib/format";
const DirtyContext = createContext<(dirty: boolean) => void>(() => {});
export function useFoodDirty(dirty: boolean) {
  const report = useContext(DirtyContext);
  useEffect(() => {
    report(dirty);
    return () => report(false);
  }, [dirty, report]);
}
export function FoodDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const confirm = useConfirm();

  const [busy, setBusy] = useState(false),
    [dirty, setDirty] = useState(false);
  useUnsavedChanges(
    dirty || busy,
    "Your unsaved food changes will be discarded.",
    busy,
  );
  return (
    <Dialog
      title={title}
      onClose={async () => {
        if (!busy && (!dirty || (await confirm("Discard unsaved changes?"))))
          onClose();
      }}
    >
      <FormBusyContext.Provider value={setBusy}>
        <DirtyContext.Provider value={setDirty}>
          {children}
        </DirtyContext.Provider>
      </FormBusyContext.Provider>
    </Dialog>
  );
}
export async function invalidateFood(cache: QueryClient) {
  await Promise.all(
    ["food", "nutrition", "calendar-activity", "dashboard"].map((key) =>
      cache.invalidateQueries({ queryKey: [key] }),
    ),
  );
}
export const nutrients = [
  ["calories", "Calories", "kcal"],
  ["proteinG", "Protein", "g"],
  ["carbsG", "Carbs", "g"],
  ["fatG", "Fat", "g"],
  ["fiberG", "Fibre", "g"],
] as const;
export function NutritionSummary({ totals }: { totals: NutritionTotals }) {
  return (
    <dl className="food-nutrients">
      {nutrients.map(([key, label, unit]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>
            {totals[key].value === null
              ? "Unknown"
              : `${number(totals[key].value)} ${unit}`}
            {totals[key].unknownCount > 0 && (
              <small>
                {totals[key].unknownCount}{" "}
                {totals[key].value === null
                  ? "not recorded"
                  : "missing · partial total"}
              </small>
            )}
          </dd>
        </div>
      ))}
    </dl>
  );
}
