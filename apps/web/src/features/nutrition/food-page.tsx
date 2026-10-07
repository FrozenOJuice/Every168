"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { localDate } from "@168hours/domain-utils";
import { dateSchema, type FoodEntry } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { useCommand, CommandError } from "@/lib/use-command";
import { PageHeading } from "@/components/ui/feedback";
import { WaterPanel } from "@/features/measurements/water-panel";
import { WeightPanel } from "@/features/measurements/weight-panel";
import { FoodLibrary } from "./food-library";
import { FoodDay } from "./food-day";
import { FoodDateNav, foodHref } from "./food-date-nav";
import { FoodOverlays, type FoodEditor } from "./food-overlays";

export function FoodPage({
  date,
  section,
}: {
  date?: string;
  section?: string;
}) {
  const {
    preferences: { timezone },
  } = useMe();
  const router = useRouter();
  const selected = dateSchema.safeParse(date).success
    ? date!
    : localDate(new Date(), timezone);
  const tab = section === "library" ? "library" : "log";
  const [editor, setEditor] = useState<FoodEditor | null>(null);
  const [notice, setNotice] = useState("");
  const cache = useQueryClient();
  function open(value: FoodEditor) {
    setNotice("");
    setEditor(value);
  }
  function navigate(date: string, nextTab = "log") {
    router.push(foodHref(date, nextTab), { scroll: false });
  }
  const remove = useCommand({
    mutationFn: (entry: FoodEntry, key: string) =>
      api.deleteFoodEntry(entry.id, entry.version, key),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["nutrition"] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
      await cache.invalidateQueries({ queryKey: ["calendar-activity"] });
      setNotice("Food entry deleted.");
    },
  });
  return (
    <div className="food-page">
      <PageHeading
        title="Food"
        description="Meals, water, and weight, one day at a time."
      >
        <div className="row page-actions">
          <button className="button" onClick={() => open({ kind: "food" })}>
            Add food
          </button>
          <button
            className="button primary"
            onClick={() => open({ kind: "entry" })}
          >
            Log food
          </button>
        </div>
      </PageHeading>
      <div className="tabs" role="group" aria-label="Food sections">
        <button aria-pressed={tab === "log"} onClick={() => navigate(selected)}>
          Daily log
        </button>
        <button
          aria-pressed={tab === "library"}
          onClick={() => navigate(selected, "library")}
        >
          Food library
        </button>
      </div>
      {notice && (
        <p className="success food-notice" role="status">
          {notice}
        </p>
      )}
      <CommandError command={remove} />
      {tab === "library" ? (
        <FoodLibrary
          onEdit={(food) => open({ kind: "food", food })}
          onLog={(food) => open({ kind: "entry", food })}
        />
      ) : (
        <>
          <FoodDateNav date={selected} timezone={timezone} />
          <nav className="food-section-links" aria-label="Daily log sections">
            <span>Jump to</span>
            <a className="button" href="#food-meals">
              Meals
            </a>
            <a className="button" href="#food-water">
              Water
            </a>
            <a className="button" href="#food-weight">
              Weight
            </a>
          </nav>
          <div className="food-daily-layout">
            <FoodDay
              date={selected}
              onAdd={(meal) => open({ kind: "entry", meal })}
              onEdit={(entry) => open({ kind: "entry", entry })}
              onRepeat={(entry) => open({ kind: "entry", entry, repeat: true })}
              onHistory={() => open({ kind: "history" })}
              deleting={remove.isPending}
              onDelete={(entry) => {
                if (confirm("Delete this food entry?")) {
                  setNotice("");
                  remove.mutate(entry);
                }
              }}
            />
            <aside className="stack" aria-label="Water and weight">
              <WaterPanel
                date={selected}
                onLog={() =>
                  open({ kind: "measurement", measurement: "water" })
                }
                onEdit={(item) =>
                  open({ kind: "measurement", measurement: "water", item })
                }
                onHistory={() =>
                  open({ kind: "measurement-history", measurement: "water" })
                }
              />
              <WeightPanel
                date={selected}
                onLog={() =>
                  open({ kind: "measurement", measurement: "weight" })
                }
                onEdit={(item) =>
                  open({ kind: "measurement", measurement: "weight", item })
                }
                onHistory={() =>
                  open({ kind: "measurement-history", measurement: "weight" })
                }
              />
            </aside>
          </div>
        </>
      )}
      {editor && (
        <FoodOverlays
          editor={editor}
          date={selected}
          setEditor={setEditor}
          onSaved={(message, savedDate) => {
            setEditor(null);
            setNotice(message);
            if (savedDate) navigate(savedDate);
          }}
          onViewDay={(date) => {
            setEditor(null);
            navigate(date);
          }}
        />
      )}
    </div>
  );
}
