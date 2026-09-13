"use client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { goalInput, type Goal } from "@168hours/contracts";
import { api } from "@/lib/api";
import { Form, Field, Submit, useZodForm } from "@/components/ui/form";
export function GoalForm({
  goal,
  date,
  onSaved,
}: {
  date?: string;
  goal?: Goal;
  onSaved: () => void;
}) {
  const form = useZodForm(
    goalInput,
    goal ?? {
      title: "",
      description: null,
      categoryId: null,
      targetDate: date ?? null,
      status: "active",
    },
  );
  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: api.getCategories,
  });
  const cache = useQueryClient();
  return (
    <Form
      form={form}
      onSubmit={async (v, key) => {
        if (goal) await api.updateGoal(goal.id, v, goal.version, key);
        else await api.createGoal(v, key);
        await cache.invalidateQueries({ queryKey: ["goals"] });
        await cache.invalidateQueries({ queryKey: ["dashboard"] });
        onSaved();
      }}
    >
      <Field name="title" label="Goal title" />
      <Field
        name="description"
        label="Description (optional)"
        type="textarea"
        optional
      />
      <div className="form-grid">
        <Field
          name="targetDate"
          label="Target date (optional)"
          type="date"
          optional
        />
        <Field name="categoryId" label="Category" optional>
          <option value="">No category</option>
          {categories.data
            ?.filter((c) => !c.archivedAt || c.id === goal?.categoryId)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </Field>
      </div>
      <Field name="status" label="Status">
        <option value="active">Active</option>
        <option value="completed">Completed</option>
        <option value="paused">Paused</option>
        <option value="archived">Archived</option>
      </Field>
      <Submit>{goal ? "Save goal" : "Create goal"}</Submit>
    </Form>
  );
}
