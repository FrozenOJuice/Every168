"use client";
import { useCommand, CommandError } from "@/lib/use-command";
import { useQueryClient } from "@tanstack/react-query";
import { Check, RotateCcw } from "lucide-react";
import type { Goal } from "@168hours/contracts";
import { api } from "@/lib/api";
import { formatDate } from "@/lib/format";
export function GoalCard({
  goal,
  onEdit,
}: {
  goal: Goal;
  onEdit?: (g: Goal) => void;
}) {
  const cache = useQueryClient();
  const update = useCommand({
    mutationFn: (goal: Goal, key: string) =>
      api.updateGoal(
        goal.id,
        {
          title: goal.title,
          description: goal.description,
          categoryId: goal.categoryId,
          targetDate: goal.targetDate,
          status: goal.status === "completed" ? "active" : "completed",
        },
        goal.version,
        key,
      ),
    onSuccess: async () => {
      await cache.invalidateQueries({ queryKey: ["goals"] });
      await cache.invalidateQueries({ queryKey: ["dashboard"] });
    },
  });
  return (
    <article className="goal-card">
      <div className="row between">
        <span className="badge">{goal.status}</span>
        {goal.targetDate && (
          <small>
            By{" "}
            {formatDate(goal.targetDate, {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </small>
        )}
      </div>
      <h3>{goal.title}</h3>
      {goal.description && (
        <p className="muted text-small">{goal.description}</p>
      )}
      <div className="row">
        <button
          className="button"
          disabled={update.isPending}
          onClick={() => update.mutate(goal)}
        >
          {goal.status === "completed" ? (
            <RotateCcw size={15} />
          ) : (
            <Check size={15} />
          )}
          {goal.status === "completed" ? "Reopen" : "Complete"}
        </button>
        {onEdit && (
          <button className="button" onClick={() => onEdit(goal)}>
            Edit
          </button>
        )}
      </div>
      <CommandError command={update} />
    </article>
  );
}
