"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Block, CopyInput, Week } from "@168hours/contracts";
import { daysBetween } from "@168hours/domain-utils";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, Loading } from "@/components/ui/feedback";
import { api } from "@/lib/api";
import { CommandError, useCommand } from "@/lib/use-command";
import { CalendarCopyPreview } from "./calendar-copy-preview";
import { useCalendarInteractions } from "./calendar-interactions";
import { invalidateCalendar } from "./invalidate-calendar";
import type { CalendarView } from "./calendar-layout";

type Clip =
  | { kind: "block"; id: string; date: string }
  | { kind: "days"; dates: string[] };
function saveClip(userId: string, clip: Clip) {
  sessionStorage.setItem(`calendar-clip:${userId}`, JSON.stringify(clip));
}
function readClip(userId: string): Clip | null {
  try {
    const value = sessionStorage.getItem(`calendar-clip:${userId}`);
    return value ? (JSON.parse(value) as Clip) : null;
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
  unavailable,
}: {
  userId: string;
  view: CalendarView;
  date: string;
  selectedTime: { date: string; minute?: number } | null;
  selectedDays: string[];
  weeks: Week[];
  unavailable: boolean;
}) {
  const interaction = useCalendarInteractions();
  const cache = useQueryClient();
  const [paste, setPaste] = useState<CopyInput | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timer);
  }, [message]);
  const preview = useQuery({
    queryKey: ["calendar-paste-preview", paste],
    enabled: !!paste,
    queryFn: () => api.previewCalendarCopy(paste!),
  });
  const single = useCommand({
    mutationFn: async (input: CopyInput, key: string) => {
      const prepared = await api.previewCalendarCopy(input);
      if (!prepared.blocks.length && !prepared.items.length)
        return { result: null, key, skipped: prepared.skipped };
      const result = await api.copyCalendar(
        { ...input, token: prepared.token },
        key,
      );
      return { result, key, skipped: prepared.skipped };
    },
    onSuccess: async ({ result, key, skipped }) => {
      if (!result) {
        setMessage("Nothing pasted: the copy would overlap its original plan.");
        return;
      }
      await invalidateCalendar(cache);
      for (const block of result.createdBlocks)
        interaction?.history.record({
          kind: "create",
          key,
          blockId: block.id,
          title: block.title,
          version: block.version,
        });
      setMessage(
        skipped
          ? `${result.count} plan pasted; ${skipped} skipped because it overlaps its original.`
          : "Plan pasted.",
      );
    },
  });
  const multiple = useCommand({
    mutationFn: async (
      value: { input: CopyInput; token: string },
      key: string,
    ) => ({
      result: await api.copyCalendar(
        { ...value.input, token: value.token },
        key,
      ),
      key,
    }),
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
      setPaste(null);
      setMessage(`${result.count} plans pasted.`);
    },
  });
  useEffect(() => {
    function keydown(event: KeyboardEvent) {
      if (
        unavailable ||
        paste ||
        interaction?.busy ||
        single.isPending ||
        multiple.isPending ||
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
        const selectedBlock: Block | undefined = weeks
          .flatMap((week) => week.blocks)
          .find((block) => block.id === interaction?.selectedId);
        if (selectedBlock) {
          saveClip(userId, { kind: "block", id: selectedBlock.id, date });
          setMessage("Plan copied.");
        } else {
          const dates = selectedDays.length
            ? [...selectedDays].sort()
            : view === "day"
              ? [date]
              : [];
          if (!dates.length) return;
          if (daysBetween(dates[0]!, dates.at(-1)!) >= 31) {
            setMessage("Select dates within a 31-day range to copy.");
          } else {
            saveClip(userId, { kind: "days", dates });
            setMessage(
              `${dates.length} ${dates.length === 1 ? "day" : "days"} copied.`,
            );
          }
        }
        event.preventDefault();
      } else if (key === "v") {
        const clip = readClip(userId);
        if (!clip) return;
        const targetDate = selectedTime?.date ?? (view === "day" ? date : null);
        if (!targetDate) {
          setMessage("Select a destination day first.");
          event.preventDefault();
          return;
        }
        if (clip.kind === "block") {
          if (view !== "month" && selectedTime?.minute === undefined) {
            setMessage("Select a five-minute time slice first.");
            event.preventDefault();
            return;
          }
          single.mutate({
            span: "single",
            sourceDate: clip.date,
            sourceId: clip.id,
            sourceKind: "block",
            targetDate,
            targetMinute: selectedTime?.minute,
          });
        } else {
          setPaste({
            span: "range",
            sourceDate: clip.dates[0]!,
            sourceEndDate: clip.dates.at(-1)!,
            selectedDates: clip.dates.join(","),
            targetDate,
          });
        }
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
    interaction,
    unavailable,
    paste,
    single,
    multiple,
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
      {message && (
        <div className="calendar-copy-feedback" aria-hidden="true">
          {message}
        </div>
      )}
      <CommandError command={single} />
      {paste && (
        <Dialog title="Paste plans" onClose={() => setPaste(null)}>
          {preview.isPending ? (
            <Loading />
          ) : preview.error ? (
            <ErrorState
              error={preview.error}
              retry={() => void preview.refetch()}
            />
          ) : preview.data ? (
            <>
              <CalendarCopyPreview preview={preview.data} />
              <div className="editor-actions">
                <button className="button" onClick={() => setPaste(null)}>
                  Cancel
                </button>
                <button
                  className="button primary"
                  disabled={
                    multiple.isPending ||
                    preview.data.blocks.length + preview.data.items.length === 0
                  }
                  onClick={() =>
                    multiple.mutate({ input: paste, token: preview.data.token })
                  }
                >
                  Paste plans
                </button>
              </div>
            </>
          ) : null}
          <CommandError command={multiple} />
        </Dialog>
      )}
    </>
  );
}
