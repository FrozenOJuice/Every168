"use client";
import { createContext, useContext } from "react";
import { ListChecks } from "lucide-react";
import { useCalendarInteractions } from "./calendar-interactions";
export const ActionsContext = createContext<{
  openActions: (anchor: HTMLButtonElement) => void;
  label: string;
  expanded: boolean;
  disabled: boolean;
} | null>(null);
export function CalendarActionButtons() {
  const actions = useContext(ActionsContext);
  const interaction = useCalendarInteractions();
  if (!actions || !interaction) return null;
  const count =
    interaction.selectedPlanCount ||
    (interaction.selection.kind === "days"
      ? interaction.selection.dates.length
      : 0);
  return (
    <div className="calendar-selection-actions">
      <span className="calendar-selection-summary sr-only" aria-live="polite">
        {interaction.multiSelect
          ? `${actions.label ? actions.label + ". " : ""}Multiple selection on.`
          : actions.label}
      </span>
      <button
        type="button"
        className="icon-button calendar-actions-button"
        aria-label="Actions"
        title={
          interaction.multiSelect
            ? "Actions (multiple selection on)"
            : actions.label
              ? `Actions (${actions.label})`
              : "Calendar actions"
        }
        aria-haspopup="menu"
        aria-expanded={actions.expanded}
        data-selecting={interaction.multiSelect || undefined}
        aria-disabled={actions.disabled}
        onClick={(event) => {
          if (!actions.disabled) actions.openActions(event.currentTarget);
        }}
      >
        <ListChecks size={18} aria-hidden="true" />
        <span className="calendar-action-label">Actions</span>
        {!!count && (
          <span className="calendar-selection-count" aria-hidden="true">
            {count}
          </span>
        )}
      </button>
    </div>
  );
}
