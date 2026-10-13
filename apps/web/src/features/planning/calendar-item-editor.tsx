import { useState } from "react";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import { useQueryClient } from "@tanstack/react-query";
import { calendarItemInput, type CalendarItem } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { invalidateCalendar } from "./invalidate-calendar";
import { useCalendarInteractions } from "./calendar-interactions";
export function CalendarItemEditor({
  item,
  date,
  kind = "all_day",
  onClose,
  onSchedule,
  onAddTime,
  onSaved,
}: {
  item?: CalendarItem;
  date: string;
  kind?: CalendarItem["kind"];
  onClose: () => void;
  onSchedule: (item: CalendarItem) => void;
  onAddTime?: (item: CalendarItem) => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const cache = useQueryClient();
  const interaction = useCalendarInteractions();
  const [formBusy, setFormBusy] = useState(false);
  const [spansMultipleDays, setSpansMultipleDays] = useState(
    kind === "all_day" && !!item?.endDate && item.endDate !== item.date,
  );
  const form = useZodForm(
    calendarItemInput,
    item ?? {
      title: "",
      categoryId: null,
      goalId: null,
      notes: null,
      kind,
      date: kind === "all_day" ? date : null,
      endDate: kind === "all_day" ? date : null,
    },
  );
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteCalendarItem(item!.id, item!.version, key),
    onSuccess: async () => {
      await invalidateCalendar(cache);
      onClose();
    },
  });
  return (
    <CalendarPlanPopover
      date={date}
      recordId={item?.id}
      busy={remove.isPending || interaction?.busy}
      onBusyChange={setFormBusy}
      title={
        item
          ? kind === "all_day"
            ? "Edit all-day plan"
            : "Edit unscheduled plan"
          : kind === "all_day"
            ? "Add all-day plan"
            : "Add unscheduled plan"
      }
      onClose={onClose}
    >
      <Form
        form={form}
        disabled={remove.isPending || interaction?.busy}
        onSubmit={async (v, key) => {
          if (item) {
            const result = await api.updateCalendarItem(
              item.id,
              v,
              item.version,
              key,
            );
            if (item.kind === "all_day")
              interaction?.history.record({
                key,
                kind: "item-edit",
                itemId: item.id,
                version: result.version,
                after: v,
                before: {
                  title: item.title,
                  notes: item.notes,
                  categoryId: item.categoryId,
                  goalId: item.goalId,
                  kind: item.kind,
                  date: item.date,
                  endDate: item.endDate,
                },
              });
          } else {
            const result = await api.createCalendarItem(v, key);
            if (v.kind === "all_day")
              interaction?.history.record({
                key,
                kind: "copy",
                blocks: [],
                items: [{ id: result.id, version: result.version }],
              });
          }
          await invalidateCalendar(cache);
          onSaved(
            v.date ? "Plan saved." : "Saved to unscheduled plans.",
            v.date ?? undefined,
          );
        }}
      >
        <Field name="title" label="Title" />
        {kind === "all_day" && (
          <p className="muted text-small">All day · No hours allocated</p>
        )}
        <div className="form-grid">
          <Field
            name="date"
            label={kind === "all_day" ? "Date" : "Date (optional)"}
            type="date"
            optional={kind !== "all_day"}
            onChange={(value) => {
              if (
                kind === "all_day" &&
                value &&
                (!spansMultipleDays ||
                  (form.getValues("endDate") ?? "") < value)
              )
                form.setValue("endDate", value);
            }}
          />
          {kind === "all_day" && (
            <label className="calendar-all-day-toggle">
              <input
                type="checkbox"
                checked={spansMultipleDays}
                onChange={(event) => {
                  setSpansMultipleDays(event.target.checked);
                  if (!event.target.checked)
                    form.setValue("endDate", form.getValues("date"));
                }}
              />
              Spans multiple days
            </label>
          )}
          {kind === "all_day" && spansMultipleDays && (
            <Field name="endDate" label="Last day" type="date" required />
          )}
        </div>
        {kind === "unscheduled" && (
          <small>Plans without a date stay in your unscheduled list.</small>
        )}
        <details>
          <summary>More details</summary>
          <div className="form-stack">
            <Field
              name="notes"
              label="Notes (optional)"
              type="textarea"
              optional
            />
          </div>
        </details>
        <Submit>{item ? "Save plan" : "Create plan"}</Submit>
      </Form>
      {item && (
        <fieldset
          className="editor-actions"
          disabled={formBusy || remove.isPending || interaction?.busy}
        >
          {kind === "all_day" && onAddTime ? (
            <div className="form-stack">
              <button className="button" onClick={() => onAddTime(item)}>
                Add a time
              </button>
              <small>The all-day plan will stay on the calendar.</small>
            </div>
          ) : (
            <button className="button" onClick={() => onSchedule(item)}>
              Schedule as time block
            </button>
          )}
          <button
            className="button danger"
            disabled={remove.isPending || interaction?.busy}
            onClick={() => {
              if (kind === "all_day" && interaction) {
                interaction.deleteItem(item);
                onClose();
                return;
              }
              if (confirm("Delete this plan?")) remove.mutate();
            }}
          >
            Delete plan
          </button>
        </fieldset>
      )}
      <CommandError command={remove} />
    </CalendarPlanPopover>
  );
}
