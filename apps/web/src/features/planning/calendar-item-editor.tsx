import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { calendarItemInput, type CalendarItem } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import { invalidateCalendar } from "./invalidate-calendar";
import { useCalendarInteractions } from "./calendar-interactions";
export function CalendarItemEditor({
  item,
  date,
  onClose,
  onSchedule,
  onSaved,
}: {
  item?: CalendarItem;
  date: string;
  kind?: "unscheduled";
  onClose: () => void;
  onSchedule: (item: CalendarItem) => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const cache = useQueryClient();
  const interaction = useCalendarInteractions();
  const [formBusy, setFormBusy] = useState(false);
  const form = useZodForm(
    calendarItemInput,
    item ?? {
      title: "",
      categoryId: null,
      goalId: null,
      notes: null,
      kind: "unscheduled",
      date: null,
      endDate: null,
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
      title={item ? "Edit unscheduled plan" : "Add unscheduled plan"}
      onClose={onClose}
    >
      <Form
        form={form}
        disabled={remove.isPending || interaction?.busy}
        onSubmit={async (v, key) => {
          if (item) await api.updateCalendarItem(item.id, v, item.version, key);
          else await api.createCalendarItem(v, key);
          await invalidateCalendar(cache);
          onSaved(
            v.date ? "Plan saved." : "Saved to unscheduled plans.",
            v.date ?? undefined,
          );
        }}
      >
        <Field name="title" label="Title" />
        <Field name="date" label="Date (optional)" type="date" optional />
        <small>Plans without a date stay in your unscheduled list.</small>
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
          <button className="button" onClick={() => onSchedule(item)}>
            Schedule as time block
          </button>
          <button
            className="button danger"
            onClick={() => {
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
