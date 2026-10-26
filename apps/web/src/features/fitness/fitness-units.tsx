"use client";
import { useState } from "react";
import { Ruler } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import type { Me, Preferences } from "@168hours/contracts";
import { Dialog } from "@/components/ui/dialog";
import { useMe } from "@/features/identity/me";
import { api } from "@/lib/api";
import { CommandError, useCommand } from "@/lib/use-command";
import { useUnsavedChanges } from "@/lib/use-unsaved-changes";
import { FitnessSelect } from "./fitness-select";
export function FitnessUnits() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button fitness-units-trigger"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <Ruler size={17} aria-hidden="true" />
        <span>Units</span>
      </button>
      {open && <UnitPreferences onClose={() => setOpen(false)} />}
    </>
  );
}
function UnitPreferences({ onClose }: { onClose: () => void }) {
  const { preferences } = useMe();
  const cache = useQueryClient();
  const [initial] = useState(preferences);
  const [units, setUnits] = useState({
    weightUnit: preferences.weightUnit,
    distanceUnit: preferences.distanceUnit,
    durationUnit: preferences.durationUnit,
  });
  const save = useCommand({
    mutationFn: (input: Preferences, key: string) =>
      api.savePreferences(input, initial.version, key),
    onSuccess: (updated) => {
      cache.setQueryData<Me>(["me"], (current) =>
        current ? { ...current, preferences: updated } : current,
      );
      onClose();
    },
  });
  useUnsavedChanges(save.isPending, undefined, true);
  return (
    <Dialog
      title="Fitness units"
      onClose={() => {
        if (!save.isPending) onClose();
      }}
    >
      <div className="form-stack fitness-unit-preferences">
        <p className="muted">
          Applies across Fitness. Existing values are converted, not changed.
        </p>
        <FitnessSelect
          label="Load unit"
          searchable={false}
          value={units.weightUnit}
          disabled={save.isPending}
          options={[
            { value: "kg", label: "Kilograms (kg)" },
            { value: "lb", label: "Pounds (lb)" },
          ]}
          onChange={(value) =>
            setUnits({
              ...units,
              weightUnit: value as Preferences["weightUnit"],
            })
          }
        />
        <FitnessSelect
          label="Distance unit"
          searchable={false}
          value={units.distanceUnit}
          disabled={save.isPending}
          options={[
            { value: "m", label: "Metres (m)" },
            { value: "km", label: "Kilometres (km)" },
            { value: "yd", label: "Yards (yd)" },
            { value: "mi", label: "Miles (mi)" },
          ]}
          onChange={(value) =>
            setUnits({
              ...units,
              distanceUnit: value as Preferences["distanceUnit"],
            })
          }
        />
        <FitnessSelect
          label="Duration unit"
          searchable={false}
          value={units.durationUnit}
          disabled={save.isPending}
          options={[
            { value: "min_sec", label: "Minutes & seconds" },
            { value: "s", label: "Seconds (s)" },
            { value: "min", label: "Minutes (min)" },
            { value: "h", label: "Hours (h)" },
          ]}
          onChange={(value) =>
            setUnits({
              ...units,
              durationUnit: value as Preferences["durationUnit"],
            })
          }
        />
        <p className="muted text-small">
          Also available in Settings. Rest timers keep their clock format.
        </p>
        <CommandError command={save} />
        <div className="fitness-confirm-actions">
          <button
            type="button"
            className="button"
            disabled={save.isPending}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button primary"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({
                timezone: initial.timezone,
                weekStartsOn: initial.weekStartsOn,
                ...units,
              })
            }
          >
            {save.retrying ? "Saving…" : "Save units"}
          </button>
        </div>
      </div>
    </Dialog>
  );
}
