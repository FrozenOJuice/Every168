"use client";
import { calendarBlocks } from "./calendar-records";

import {
  createContext,
  useContext,
  useCallback,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
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
import {
  useCalendarInteractions,
  type PlanSelection,
} from "./calendar-interactions";
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

type ClipboardActions = {
  copyPlans: (plans: PlanSelection[]) => void;
  copyDays: (dates: string[]) => void;
  duplicate: (plans: PlanSelection[]) => void;
  pasteAt: (date: string, minute?: number) => void;
  canPaste: () => boolean;
  busy: boolean;
};
const ClipboardContext = createContext<ClipboardActions | null>(null);
export const useCalendarClipboard = () => useContext(ClipboardContext);

export function CalendarClipboard({
  userId,
  view,
  date,
  selectedTime,
  selectedDays,
  weeks,
  items,
  unavailable,
  feedbackContainer,
  children,
}: {
  userId: string;
  view: CalendarView;
  date: string;
  selectedTime: { date: string; minute?: number } | null;
  selectedDays: string[];
  weeks: Week[];
  items: CalendarItem[];
  unavailable: boolean;
  feedbackContainer?: Element | null;
  children: ReactNode;
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
    mutationFn: async (
      {
        duplicate = false,
        ...input
      }: SnapshotPasteInput & { duplicate?: boolean },
      key: string,
    ) => {
      const prepared = await api.previewCalendarSnapshotPaste(input);
      const result = await api.pasteCalendarSnapshot(
        { ...input, token: prepared.token },
        key,
      );
      return { result, key, duplicate };
    },
    onSuccess: async ({ result, key, duplicate }) => {
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
      notify(duplicate ? "Plans duplicated" : "Plans pasted", {
        undoKey: key,
        kind: "change",
      });
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
  const timezone = weeks[0]?.timezone;
  const setClipboardBusy = interaction?.setClipboardBusy;
  useEffect(() => {
    setClipboardBusy?.(paste.isPending);
    return () => setClipboardBusy?.(false);
  }, [paste.isPending, setClipboardBusy]);
  const allBlocks = calendarBlocks(weeks);
  function capture(
    kind: Clip["kind"],
    sourceDate: string,
    blocks: Block[],
    selectedItems: CalendarItem[],
  ): Clip | null {
    if (!timezone) {
      notify("Calendar is still loading. Try copying again.");
      return null;
    }
    if (!blocks.length && !selectedItems.length) {
      notify("No plans to copy.");
      return null;
    }
    const snapshot = clipboardSnapshotSchema.safeParse({
      sourceDate,
      timezone,
      blocks: blocks.map(
        ({ title, categoryId, goalId, notes, startsAt, endsAt }) => ({
          title,
          categoryId,
          goalId,
          notes,
          startsAt,
          endsAt,
        }),
      ),
      items: selectedItems.map(
        ({ title, categoryId, goalId, notes, kind, date, endDate }) => ({
          title,
          categoryId,
          goalId,
          notes,
          kind,
          date,
          endDate,
        }),
      ),
    });
    if (!snapshot.success) {
      notify("Select up to 100 dated plans to copy.");
      return null;
    }
    return { kind, snapshot: snapshot.data };
  }
  function capturePlans(plans: PlanSelection[]) {
    if (!timezone) {
      notify("Calendar is still loading. Try copying again.");
      return null;
    }
    const blocks = allBlocks.filter((block) =>
      plans.some((plan) => plan.kind === "block" && plan.id === block.id),
    );
    const selectedItems = items.filter(
      (item) =>
        item.kind === "all_day" &&
        item.date &&
        plans.some((plan) => plan.kind === "item" && plan.id === item.id),
    );
    if (
      !plans.length ||
      blocks.length + selectedItems.length !== plans.length
    ) {
      notify("Selection changed. Select the plans again.");
      return null;
    }
    const dates = [
      ...blocks.map((block) => localDate(block.startsAt, timezone)),
      ...selectedItems.map((item) => item.date!),
    ].sort();
    if (daysBetween(dates[0]!, dates.at(-1)!) >= 31) {
      notify("Select plans within a 31-day range to copy.");
      return null;
    }
    return capture(
      plans.length > 1 ? "selection" : blocks.length ? "block" : "item",
      dates[0]!,
      blocks,
      selectedItems,
    );
  }
  function store(clip: Clip | null, label: string) {
    if (!clip) return;
    try {
      saveClip(userId, clip);
      notify(label, { kind: "copy" });
    } catch {
      notify("Could not copy plans in this tab.", { kind: "error" });
    }
  }
  const blocked = unavailable || !!interaction?.busy || paste.isPending;
  function copyPlans(plans: PlanSelection[]) {
    if (blocked) return;
    store(
      capturePlans(plans),
      plans.length === 1 ? "Plan copied." : `${plans.length} plans copied.`,
    );
  }
  function copyDays(selected: string[]) {
    if (blocked) return;
    const dates = [...selected].sort();
    if (!dates.length) {
      notify("Select a plan or day to copy.");
      return;
    }
    if (!timezone) {
      notify("Calendar is still loading. Try copying again.");
      return;
    }
    if (daysBetween(dates[0]!, dates.at(-1)!) >= 31) {
      notify("Select dates within a 31-day range to copy.");
      return;
    }
    store(
      capture(
        "days",
        dates[0]!,
        allBlocks.filter((block) =>
          dates.includes(localDate(block.startsAt, timezone)),
        ),
        items.filter(
          (item) =>
            item.kind === "all_day" && !!item.date && dates.includes(item.date),
        ),
      ),
      `${dates.length} ${dates.length === 1 ? "day" : "days"} copied.`,
    );
  }
  function duplicate(plans: PlanSelection[]) {
    if (blocked) return;
    const clip = capturePlans(plans);
    if (clip)
      paste.mutate({
        snapshot: clip.snapshot,
        targetDate: clip.snapshot.sourceDate,
        duplicate: true,
      });
  }
  function pasteAt(targetDate: string, minute?: number) {
    if (blocked) return;
    const clip = readClip(userId);
    if (!clip) {
      notify("Copy a plan or day before pasting.");
      return;
    }
    paste.mutate({
      snapshot: clip.snapshot,
      targetDate,
      targetMinute:
        clip.kind === "block" || clip.kind === "selection" ? minute : undefined,
    });
  }
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        blocked ||
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
      if (key === "c") {
        if (interaction?.selectedPlanCount)
          copyPlans(interaction.selectedPlans);
        else copyDays(selectedDays);
        event.preventDefault();
      } else if (key === "v") {
        const clip = readClip(userId);
        if (!clip) {
          notify("Copy a plan or day before pasting.");
          event.preventDefault();
          return;
        }
        if (
          clip.kind !== "days" &&
          interaction?.selectedPlanCount &&
          !selectedTime &&
          !selectedDays.length
        ) {
          paste.mutate({
            snapshot: clip.snapshot,
            targetDate: clip.snapshot.sourceDate,
          });
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
        pasteAt(
          targetDate,
          view === "month" ? undefined : selectedTime?.minute,
        );
        event.preventDefault();
      }
    }
    window.addEventListener("keydown", keydown);
    return () => window.removeEventListener("keydown", keydown);
  });
  const feedback = (
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
  return (
    <ClipboardContext.Provider
      value={{
        copyPlans,
        copyDays,
        duplicate,
        pasteAt,
        canPaste: () => !!readClip(userId),
        busy: blocked,
      }}
    >
      {children}
      {feedbackContainer ? createPortal(feedback, feedbackContainer) : feedback}
    </ClipboardContext.Provider>
  );
}
