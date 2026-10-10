import { useState } from "react";
import Link from "next/link";
import { CalendarPlanPopover } from "./calendar-plan-popover";
import { TimeForm } from "./time-form";
import type {
  TimeEditor,
  CalendarDraft,
  CalendarSaveResult,
} from "./calendar-layout";

export function CalendarComposer({
  editor,
  onClose,
  onSaved,
  onDraftChange,
}: {
  editor: TimeEditor;
  onClose: () => void;
  onSaved: (result: CalendarSaveResult) => void;
  onDraftChange?: (draft: CalendarDraft | null) => void;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <CalendarPlanPopover
      date={editor.date}
      onBusyChange={setBusy}
      title="Add plan"
      onClose={() => {
        if (!busy) onClose();
      }}
    >
      <TimeForm
        {...editor}
        compact
        allowRepeat
        allowAllDay
        initialAllDay={editor.allDay ?? false}
        initialRepeat={editor.repeat ? "weekly" : "never"}
        onSaved={onSaved}
        onDraftChange={onDraftChange}
      />
      <details>
        <summary>Other plans</summary>
        <div className="row wrap composer-plan-types">
          <Link
            className="text-button"
            href="/unscheduled"
            aria-disabled={busy}
            onClick={(event) => {
              if (busy) event.preventDefault();
            }}
          >
            Unscheduled plans
          </Link>
        </div>
      </details>
    </CalendarPlanPopover>
  );
}
