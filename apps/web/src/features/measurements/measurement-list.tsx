"use client";
import { useQueryClient } from "@tanstack/react-query";
import type { Water, Weight } from "@168hours/contracts";
import { fromKilograms, localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { formatDate, formatTime, number } from "@/lib/format";

export function MeasurementList({
  kind,
  entries,
  onEdit,
  showDate = false,
}: {
  kind: "water" | "weight";
  entries: (Water | Weight)[];
  onEdit: (entry: Water | Weight) => void;
  showDate?: boolean;
}) {
  const {
    preferences: { timezone, weightUnit },
  } = useMe();
  const cache = useQueryClient();
  const remove = useCommand({
    mutationFn: (entry: Water | Weight, key: string) =>
      kind === "water"
        ? api.deleteWater(entry.id, entry.version, key)
        : api.deleteWeight(entry.id, entry.version, key),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: [kind] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <>
      <ul className="record-list measurement-list">
        {entries.map((entry) => {
          const at =
            "measuredAt" in entry ? entry.measuredAt : entry.consumedAt;
          return (
            <li key={entry.id}>
              <div>
                <strong>
                  {"weightKg" in entry
                    ? number(fromKilograms(entry.weightKg, weightUnit), 2) +
                      " " +
                      weightUnit
                    : number(entry.amountMl, 0) + " ml"}
                </strong>
                <small>
                  {showDate &&
                    formatDate(localDate(at, timezone), {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    }) + " · "}
                  {formatTime(at, timezone, true)}
                </small>
              </div>
              <div className="row">
                <button
                  className="button"
                  disabled={remove.isPending}
                  onClick={() => onEdit(entry)}
                >
                  Edit
                </button>
                <button
                  className="button danger"
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm("Delete this " + kind + " entry?"))
                      remove.mutate(entry);
                  }}
                >
                  Delete
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <CommandError command={remove} />
      {remove.isSuccess && (
        <p className="success" role="status">
          Entry deleted.
        </p>
      )}
    </>
  );
}
