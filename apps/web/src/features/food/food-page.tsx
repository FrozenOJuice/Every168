"use client";
import { useState } from "react";
import Link from "next/link";
import { CalendarDays, Plus, Utensils } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  type CalendarActivity,
  type Food,
  type FoodEntry,
  type FoodEntryDetail,
  type Water,
  type Weight,
} from "@168hours/contracts";
import { localDate } from "@168hours/domain-utils";
import { api } from "@/lib/api";
import { useMe } from "@/features/identity/me";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { WaterPanel } from "@/features/measurements/water-panel";
import { WeightPanel } from "@/features/measurements/weight-panel";
import { MeasurementForm } from "@/features/measurements/measurement-form";
import { MeasurementHistory } from "@/features/measurements/measurement-history";
import { FoodDialog, NutritionSummary } from "./food-shared";
import { Dialog } from "@/components/ui/dialog";
import { formatDate } from "@/lib/format";
import { DomainDayPanel } from "@/features/workspace/domain-day-panel";
import { useDomainDay } from "@/features/workspace/domain-day-context";
import { FoodFavourites } from "./food-favourites";
import { FoodEditor } from "./food-editor";
import { PreparationEditor } from "./preparation-editor";
import { FoodLog } from "./food-log";
import { FoodLibrary } from "./food-library";
import { FoodEntries, FoodHistory } from "./food-entries";

type Modal =
  | { type: "editFood"; kind: Food["kind"]; food?: Food }
  | { type: "entry"; id: string }
  | { type: "log"; food?: Food; entry?: FoodEntry; repeat?: boolean }
  | { type: "measurement"; kind: "water" | "weight"; item?: Water | Weight }
  | { type: "measurementHistory"; kind: "water" | "weight" };
const views = [
  ["day", "Daily log"],
  ["food", "Food library"],
  ["meal", "Saved meals"],
  ["recipe", "Recipes"],
  ["history", "History"],
] as const;
export function FoodPage() {
  const {
    preferences: { timezone },
  } = useMe();
  const params = useSearchParams();
  const router = useRouter();
  const today = localDate(new Date(), timezone);
  const { date } = useDomainDay();
  const selected = params.get("view") ?? "day";
  const view = views.some(([v]) => v === selected) ? selected : "day";
  const [dayOpen, setDayOpen] = useState(false);
  const [modal, setModal] = useState<Modal | null>(null);
  const url = (nextView = view, nextDate = date) =>
    `/food?view=${nextView}&date=${nextDate}`;
  const q = useQuery({
    queryKey: ["nutrition", "daily", date, timezone],
    queryFn: () => api.getNutritionDaily(date),
    enabled: view === "day",
  });
  const actions = {
    onEdit: (entry: FoodEntryDetail) => setModal({ type: "log", entry }),
    onRepeat: (entry: FoodEntryDetail) =>
      setModal({ type: "log", entry, repeat: true }),
  };
  const logged = (entry: FoodEntry) => {
    setModal(null);
    router.push(url("day", localDate(entry.consumedAt, timezone)));
  };
  const openLog = () => {
    setDayOpen(false);
    setModal({ type: "log" });
  };
  const openActivity = (activity: CalendarActivity) => {
    setDayOpen(false);
    if (activity.source.type === "food_entry")
      setModal({ type: "entry", id: activity.source.id });
    else if (["water_entry", "weight_entry"].includes(activity.source.type))
      router.push(
        url("day") +
          (activity.source.type === "water_entry"
            ? "#food-water"
            : "#food-weight"),
      );
    else router.push(activity.href);
  };
  const dayPanel = (
    <DomainDayPanel
      domain="Food"
      sources={["food_entry", "water_entry", "weight_entry"]}
      sourceLabels={["Food", "Water", "Weight"]}
      date={date}
      onDate={(value) => router.push(url(view, value))}
      action={{ label: "Add food", onClick: openLog }}
      onActivity={openActivity}
      onCalendar={() => router.push(`/?date=${date}&view=day`)}
    />
  );
  return (
    <div className="food-workspace">
      <div className="food-main">
        <header className="food-header">
          <div className="food-title">
            <Utensils size={20} aria-hidden="true" />
            <h1>Food</h1>
          </div>
          <button
            className="button food-mobile-day"
            onClick={() => setDayOpen(true)}
            aria-haspopup="dialog"
          >
            <CalendarDays size={17} aria-hidden="true" />
            Day
          </button>
        </header>
        <nav className="food-nav" aria-label="Food navigation">
          {views.map(([v, label]) => (
            <Link
              key={v}
              href={url(v)}
              aria-current={view === v ? "page" : undefined}
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="food-content">
          {view === "day" ? (
            <div className="food-daily-grid">
              <div className="food-daily-main">
                <section className="food-daily-section">
                  <div className="food-section-heading">
                    <div>
                      <p className="food-eyebrow">
                        {formatDate(date, {
                          weekday: "long",
                          month: "long",
                          day: "numeric",
                        })}
                      </p>
                      <h2>
                        {date === today ? "Today’s food" : "Food for this day"}
                      </h2>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => setModal({ type: "log" })}
                    >
                      <Plus size={17} aria-hidden="true" /> Log food
                    </button>
                  </div>
                  {q.isPending ? (
                    <Loading />
                  ) : q.error ? (
                    <ErrorState
                      error={q.error}
                      retry={() => void q.refetch()}
                    />
                  ) : (
                    <>
                      {q.data.entries.length ? (
                        <>
                          <details className="food-nutrition-overview" open>
                            <summary>Daily nutrition</summary>
                            <NutritionSummary totals={q.data.totals} />
                            {Object.values(q.data.totals).some(
                              (total) => total.unknownCount > 0,
                            ) && (
                              <p className="muted text-small">
                                Partial totals exclude entries with missing
                                values.
                              </p>
                            )}
                          </details>
                          <FoodFavourites
                            onLog={(food) => setModal({ type: "log", food })}
                          />
                          <div className="food-log-heading">
                            <h2>Food log</h2>
                            <span>
                              {q.data.entries.length}{" "}
                              {q.data.entries.length === 1
                                ? "entry"
                                : "entries"}
                            </span>
                          </div>
                          <FoodEntries entries={q.data.entries} {...actions} />
                        </>
                      ) : (
                        <>
                          <FoodFavourites
                            onLog={(food) => setModal({ type: "log", food })}
                          />
                          <div className="food-empty">
                            <Utensils size={28} aria-hidden="true" />
                            <h3>Start with something you ate</h3>
                            <p>No food recorded for this day.</p>
                            <p className="muted">
                              Choose a saved food, meal or recipe, or make a
                              quick entry without tracking nutrition.
                            </p>
                          </div>
                        </>
                      )}
                    </>
                  )}
                </section>
              </div>
              <aside
                className="food-measurements"
                aria-label="Water and weight"
              >
                <WaterPanel
                  date={date}
                  onLog={() => setModal({ type: "measurement", kind: "water" })}
                  onEdit={(item) =>
                    setModal({ type: "measurement", kind: "water", item })
                  }
                  onHistory={() =>
                    setModal({ type: "measurementHistory", kind: "water" })
                  }
                />
                <WeightPanel
                  date={date}
                  onLog={() =>
                    setModal({ type: "measurement", kind: "weight" })
                  }
                  onEdit={(item) =>
                    setModal({ type: "measurement", kind: "weight", item })
                  }
                  onHistory={() =>
                    setModal({ type: "measurementHistory", kind: "weight" })
                  }
                />
              </aside>
            </div>
          ) : view === "history" ? (
            <FoodHistory {...actions} />
          ) : (
            <FoodLibrary
              key={view}
              kind={view as Food["kind"]}
              onCreate={() =>
                setModal({ type: "editFood", kind: view as Food["kind"] })
              }
              onEdit={(food) =>
                setModal({ type: "editFood", kind: food.kind, food })
              }
              onLog={(food) => setModal({ type: "log", food })}
            />
          )}
        </div>
      </div>
      <aside className="domain-calendar-rail" aria-label="Food day panel">
        {dayPanel}
      </aside>
      {dayOpen && (
        <Dialog title="Your day" onClose={() => setDayOpen(false)}>
          {dayPanel}
        </Dialog>
      )}
      {modal && (
        <FoodDialog
          title={
            modal.type === "entry"
              ? "Edit food entry"
              : modal.type === "editFood"
                ? `${modal.food ? "Edit" : "Create"} ${modal.kind}`
                : modal.type === "log"
                  ? modal.entry && !modal.repeat
                    ? "Edit food entry"
                    : modal.repeat
                      ? "Copy food entry"
                      : "Log food"
                  : `${modal.kind === "water" ? "Water" : "Weight"}${modal.type === "measurementHistory" ? " history" : " entry"}`
          }
          onClose={() => setModal(null)}
        >
          {modal.type === "entry" ? (
            <RecordedFood id={modal.id} date={date} onSaved={logged} />
          ) : modal.type === "editFood" ? (
            modal.kind === "food" ? (
              <FoodEditor item={modal.food} onSaved={() => setModal(null)} />
            ) : (
              <PreparationEditor
                kind={modal.kind}
                item={modal.food}
                onSaved={() => setModal(null)}
              />
            )
          ) : modal.type === "log" ? (
            <FoodLog
              date={date}
              initialFood={modal.food}
              entry={modal.entry}
              repeat={modal.repeat}
              onSaved={logged}
            />
          ) : modal.type === "measurementHistory" ? (
            <MeasurementHistory kind={modal.kind} through={date} />
          ) : (
            <MeasurementForm
              kind={modal.kind}
              item={modal.item}
              date={date}
              onSaved={(item) => {
                setModal(null);
                router.push(
                  url(
                    "day",
                    localDate(
                      "consumedAt" in item ? item.consumedAt : item.measuredAt,
                      timezone,
                    ),
                  ),
                );
              }}
            />
          )}
        </FoodDialog>
      )}
    </div>
  );
}

function RecordedFood({
  id,
  date,
  onSaved,
}: {
  id: string;
  date: string;
  onSaved: (entry: FoodEntry) => void;
}) {
  const q = useQuery({
    queryKey: ["food", "entry", id],
    queryFn: () => api.getFoodEntry(id),
  });
  return q.isPending ? (
    <Loading />
  ) : q.error ? (
    <ErrorState error={q.error} retry={() => void q.refetch()} />
  ) : (
    <FoodLog date={date} entry={q.data} onSaved={onSaved} />
  );
}
