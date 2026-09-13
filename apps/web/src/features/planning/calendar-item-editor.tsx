import { useWatch } from "react-hook-form";
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { calendarItemInput, type CalendarItem } from "@168hours/contracts";
import { api } from "@/lib/api";
import { useCommand, CommandError } from "@/lib/use-command";
import { Dialog } from "@/components/ui/dialog";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
import { Loading, ErrorState } from "@/components/ui/feedback";
import { CalendarItemButton } from "./calendar-item-button";
import { invalidateCalendar } from "./invalidate-calendar";
export function CalendarItemEditor({
  item,
  date,
  kind = "all_day",
  onClose,
  onSchedule,
  onSaved,
}: {
  item?: CalendarItem;
  date: string;
  kind?: CalendarItem["kind"];
  onClose: () => void;
  onSchedule: (item: CalendarItem) => void;
  onSaved: (message: string, date?: string) => void;
}) {
  const cache = useQueryClient();
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
  const selectedKind = useWatch({ control: form.control, name: "kind" });
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const goals = useQuery({
    queryKey: ["goals", "selector"],
    queryFn: () => api.getGoals({ limit: 100, status: "active" }),
  });
  const remove = useCommand({
    mutationFn: (_: void, key: string) =>
      api.deleteCalendarItem(item!.id, item!.version, key),
    onSuccess: async () => {
      await invalidateCalendar(cache);
      onClose();
    },
  });
  return (
    <Dialog
      title={item ? "Edit date-only plan" : "Add date-only plan"}
      onClose={onClose}
    >
      <Form
        form={form}
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
        <Field
          name="kind"
          label="Plan type"
          onChange={(value) => {
            form.setValue(
              "endDate",
              value === "all_day" ? (form.getValues("date") ?? date) : null,
            );
            if (value === "all_day" && !form.getValues("date"))
              form.setValue("date", date);
          }}
        >
          <option value="all_day">All day</option>
          <option value="unscheduled">Unscheduled</option>
        </Field>
        <div className="form-grid">
          <Field
            name="date"
            label={selectedKind === "all_day" ? "Date" : "Date (optional)"}
            type="date"
            optional
            onChange={(value) => {
              if (
                selectedKind === "all_day" &&
                value &&
                (form.getValues("endDate") ?? "") < value
              )
                form.setValue("endDate", value);
            }}
          />
          {selectedKind === "all_day" && (
            <Field name="endDate" label="Last day (inclusive)" type="date" />
          )}
        </div>
        <small>
          These plans do not allocate hours. Unscheduled plans without a date
          stay in your unscheduled list.
        </small>
        <Field name="categoryId" label="Category" optional>
          <option value="">Uncategorized</option>
          {categories.data
            ?.filter((c) => !c.archivedAt || c.id === item?.categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Field>
        <Field name="goalId" label="Goal (optional)" optional>
          <option value="">No linked goal</option>
          {item?.goalId &&
            !goals.data?.items.some((g) => g.id === item.goalId) && (
              <option value={item.goalId}>Previously linked goal</option>
            )}
          {goals.data?.items.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </Field>
        <Field name="notes" label="Notes (optional)" type="textarea" optional />
        <Submit>{item ? "Save plan" : "Create plan"}</Submit>
      </Form>
      {item && (
        <div className="editor-actions">
          <button className="button" onClick={() => onSchedule(item)}>
            Schedule as time block
          </button>
          <button
            className="button danger"
            disabled={remove.isPending}
            onClick={() => {
              if (confirm("Delete this plan?")) remove.mutate();
            }}
          >
            Delete plan
          </button>
        </div>
      )}
      <CommandError command={remove} />
    </Dialog>
  );
}
export function CalendarBacklog({
  onClose,
  onOpen,
  onAdd,
}: {
  onClose: () => void;
  onOpen: (item: CalendarItem) => void;
  onAdd: () => void;
}) {
  const q = useInfiniteQuery({
    queryKey: ["calendar-items", "backlog"],
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.getCalendarBacklog({ cursor: pageParam }),
    getNextPageParam: (p) => p.nextCursor ?? undefined,
  });
  const items = q.data?.pages.flatMap((p) => p.items) ?? [];
  return (
    <Dialog title="Unscheduled plans" onClose={onClose}>
      <p className="muted">
        Plans without a date. Open one to choose a date or schedule time.
      </p>
      <button className="button primary" onClick={onAdd}>
        Add unscheduled plan
      </button>
      {q.isPending && <Loading />}
      {q.error && <ErrorState error={q.error} retry={() => void q.refetch()} />}
      <ol className="day-records">
        {items.map((item) => (
          <li key={item.id}>
            <CalendarItemButton item={item} onOpen={() => onOpen(item)} />
          </li>
        ))}
      </ol>
      {!q.isPending && !q.error && !items.length && <p>No undated plans.</p>}
      {q.hasNextPage && (
        <button
          className="button"
          disabled={q.isFetchingNextPage}
          onClick={() => void q.fetchNextPage()}
        >
          Load more
        </button>
      )}
    </Dialog>
  );
}
