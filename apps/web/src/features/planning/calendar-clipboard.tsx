"use client";

import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  clipboardSnapshotSchema,
  type Block,
  type CalendarItem,
  type ClipboardSnapshot,
  type SnapshotPasteInput,
  type Week,
} from "@168hours/contracts";
import { daysBetween, localDate } from "@168hours/domain-utils";
import { ApiError, uncertainWrite } from "@168hours/api-client";
import { api } from "@/lib/api";
import { CommandError, useCommand } from "@/lib/use-command";
import { useCalendarInteractions } from "./calendar-interactions";
import { invalidateCalendar } from "./invalidate-calendar";
import type { CalendarView } from "./calendar-layout";

type Clip = {
  kind: "block" | "item" | "selection" | "days";
  snapshot: ClipboardSnapshot;
};
const clipboardKey = (userId: string) => `calendar-clip:v2:${userId}`;
function saveClip(userId: string, clip: Clip) {
  sessionStorage.setItem(clipboardKey(userId), JSON.stringify(clip));
}
function readClip(userId: string): Clip | null {
  try {
    const value = sessionStorage.getItem(clipboardKey(userId));
    if (!value) return null;
    const clip = JSON.parse(value) as Partial<Clip>;
    if (
      !clip.kind ||
      !["block", "item", "selection", "days"].includes(clip.kind)
    )
      return null;
    const snapshot = clipboardSnapshotSchema.safeParse(clip.snapshot);
    return snapshot.success
      ? { kind: clip.kind, snapshot: snapshot.data }
      : null;
  } catch {
    return null;
  }
}

export function CalendarClipboard({
  userId,
  view,
  date,
  selectedTime,
  selectedDays,
  weeks,
  items,
  unavailable,
}: {
  userId: string;
  view: CalendarView;
  date: string;
  selectedTime: { date: string; minute?: number } | null;
  selectedDays: string[];
  weeks: Week[];
  items: CalendarItem[];
  unavailable: boolean;
}) {
  const interaction = useCalendarInteractions();
  const cache = useQueryClient();
  const [message, setMessage] = useState("");
  const notify = useCallback(
    (
      text: string,
      options?: {
        undoKey?: string;
        action?: { label: string; onClick: () => void };
        kind?: "copy" | "change" | "hint" | "error";
      },
    ) => {
      setMessage(text);
      interaction?.showNotice(text, options);
    },
    [interaction],
  );
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const paste = useCommand({
    mutationFn: async (input: SnapshotPasteInput, key: string) => {
      const prepared = await api.previewCalendarSnapshotPaste(input);
      const result = await api.pasteCalendarSnapshot(
        { ...input, token: prepared.token },
        key,
      );
      return { result, key };
    },
    onSuccess: async ({ result, key }) => {
      interaction?.history.record({
        key,
        kind: "copy",
        blocks: result.createdBlocks.map(({ id, version }) => ({
          id,
          version,
        })),
        items: result.createdItems,
      });
      await invalidateCalendar(cache);
      notify("Plans pasted", { undoKey: key, kind: "change" });
    },
    onError: (error) => {
      if (uncertainWrite(error)) {
        notify("Could not confirm paste. Retry the same change.", {
          kind: "error",
          action: { label: "Retry", onClick: () => paste.retry() },
        });
      } else {
        notify(`Could not paste plans. ${error.message}`, { kind: "error" });
      }
    },
  });
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        unavailable ||
        interaction?.busy ||
        paste.isPending ||
        event.defaultPrevented ||
        event.repeat ||
        event.isComposing ||
        event.altKey ||
        event.shiftKey ||
        !(event.metaKey || event.ctrlKey) ||
        (event.target instanceof Element &&
          event.target.closest(
            'input, textarea, select, [contenteditable]:not([contenteditable="false"]), [role="textbox"], [role="dialog"], [role="menu"]',
          ))
      )
        return;
      const key = event.key.toLowerCase();
      const timezone = weeks[0]?.timezone;
      const allBlocks = weeks.flatMap((week) => week.blocks);
      if (key === "c" && !timezone) {
        notify("Calendar is still loading. Try copying again.");
        event.preventDefault();
        return;
      }
      function capture(
        kind: Clip["kind"],
        sourceDate: string,
        blocks: Block[],
        selectedItems: CalendarItem[],
        label: string,
      ) {
        if (!timezone || (!blocks.length && !selectedItems.length)) {
          notify("No plans to copy.");
          return;
        }
        const snapshot = clipboardSnapshotSchema.safeParse({
          sourceDate,
          timezone,
          blocks: blocks.map((block) => ({
            title: block.title,
            categoryId: block.categoryId,
            goalId: block.goalId,
            notes: block.notes,
            startsAt: block.startsAt,
            endsAt: block.endsAt,
          })),
          items: selectedItems.map((item) => ({
            title: item.title,
            categoryId: item.categoryId,
            goalId: item.goalId,
            notes: item.notes,
            kind: item.kind,
            date: item.date,
            endDate: item.endDate,
          })),
        });
        if (!snapshot.success) {
          notify("Select up to 100 dated plans to copy.");
          return;
        }
        try {
          saveClip(userId, { kind, snapshot: snapshot.data });
          notify(label, { kind: "copy" });
        } catch {
          notify("Could not copy plans in this tab.", { kind: "error" });
        }
      }
      if (key === "c") {
        if (interaction && interaction.selectedPlanCount > 1) {
          const records = interaction.selectedPlans.map((plan) => {
            const source =
              plan.kind === "block"
                ? allBlocks.find((block) => block.id === plan.id)
                : items.find((item) => item.id === plan.id);
            const sourceDate =
              source && plan.kind === "block" && "startsAt" in source
                ? localDate(source.startsAt, timezone!)
                : source && "date" in source
                  ? source.date
                  : null;
            return sourceDate ? { plan, sourceDate } : null;
          });
          if (records.some((record) => !record)) {
            notify("Selection changed. Select the plans again.");
            event.preventDefault();
            return;
          }
          const selected = records.filter((record) => record !== null);
          const sourceDate = selected
            .map((record) => record.sourceDate)
            .sort()[0]!;
          if (
            daysBetween(
              sourceDate,
              selected
                .map((record) => record.sourceDate)
                .sort()
                .at(-1)!,
            ) >= 31
          ) {
            notify("Select plans within a 31-day range to copy.");
            event.preventDefault();
            return;
          }
          capture(
            "selection",
            sourceDate,
            allBlocks.filter((block) =>
              interaction.selectedPlans.some(
                (plan) => plan.kind === "block" && plan.id === block.id,
              ),
            ),
            items.filter((item) =>
              interaction.selectedPlans.some(
                (plan) => plan.kind === "item" && plan.id === item.id,
              ),
            ),
            `${selected.length} plans copied.`,
          );
          event.preventDefault();
          return;
        }
        const selectedBlock = allBlocks.find(
          (block) => block.id === interaction?.selectedId,
        );
        if (selectedBlock) {
          capture(
            "block",
            localDate(selectedBlock.startsAt, timezone!),
            [selectedBlock],
            [],
            "Plan copied.",
          );
        } else if (interaction?.selectedItemId) {
          const selectedItem = items.find(
            (item) =>
              item.id === interaction.selectedItemId &&
              item.kind === "all_day" &&
              item.date !== null,
          );
          if (!selectedItem?.date) {
            notify("Selection changed. Select the plan again.");
            event.preventDefault();
            return;
          }
          capture(
            "item",
            selectedItem.date,
            [],
            [selectedItem],
            "Plan copied.",
          );
        } else {
          const dates = [...selectedDays].sort();
          if (!dates.length) {
            notify("Select a plan or day to copy.");
            event.preventDefault();
            return;
          }
          if (daysBetween(dates[0]!, dates.at(-1)!) >= 31) {
            notify("Select dates within a 31-day range to copy.");
          } else {
            capture(
              "days",
              dates[0]!,
              allBlocks.filter((block) =>
                dates.includes(localDate(block.startsAt, timezone!)),
              ),
              items.filter(
                (item) =>
                  item.kind === "all_day" &&
                  !!item.date &&
                  dates.includes(item.date),
              ),
              `${dates.length} ${dates.length === 1 ? "day" : "days"} copied.`,
            );
          }
        }
        event.preventDefault();
      } else if (key === "v") {
        const clip = readClip(userId);
        if (!clip) {
          notify("Copy a plan or day before pasting.");
          event.preventDefault();
          return;
        }
        if (
          (clip.kind === "days" ||
            clip.kind === "item" ||
            (clip.kind === "selection" && !clip.snapshot.blocks.length)) &&
          view === "day" &&
          !selectedDays.includes(date)
        ) {
          notify("Select the day heading before pasting.");
          event.preventDefault();
          return;
        }
        if (
          view === "day" &&
          (clip.kind === "block" ||
            (clip.kind === "selection" && !!clip.snapshot.blocks.length)) &&
          selectedTime?.minute === undefined &&
          !selectedDays.includes(date)
        ) {
          notify("Select the day heading or a five-minute time slice first.");
          event.preventDefault();
          return;
        }
        const targetDate = selectedTime?.date ?? (view === "day" ? date : null);
        if (!targetDate) {
          notify("Select a destination day first.");
          event.preventDefault();
          return;
        }
        paste.mutate({
          snapshot: clip.snapshot,
          targetDate,
          targetMinute:
            clip.kind === "block" || clip.kind === "selection"
              ? view === "month"
                ? undefined
                : selectedTime?.minute
              : undefined,
        });
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  }, [
    userId,
    view,
    date,
    selectedTime,
    selectedDays,
    weeks,
    items,
    interaction,
    unavailable,
    paste,
    notify,
  ]);
  return (
    <>
      <span
        className="sr-only"
        aria-live="polite"
        data-calendar-clipboard-status
      >
        {message}
      </span>
      {(paste.needsRetry ||
        (paste.error instanceof ApiError &&
          paste.error.code === "STALE_REVISION")) &&
        interaction?.notice?.kind !== "error" && (
          <CommandError command={paste} />
        )}
    </>
  );
}
