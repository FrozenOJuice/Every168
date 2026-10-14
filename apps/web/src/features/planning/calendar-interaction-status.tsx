import { createPortal } from "react-dom";
import { CommandError } from "@/lib/use-command";
import { useCalendarInteractions } from "./calendar-interactions";
export function CalendarInteractionStatus({
  container,
}: {
  container?: Element | null;
}) {
  const interaction = useCalendarInteractions();
  if (!interaction) return null;
  const notice = interaction.notice;
  const canUndoNotice =
    !!notice?.undoKey &&
    interaction.history.actions.at(-1)?.key === notice.undoKey;
  const content = (
    <>
      {notice && (
        <div className="calendar-notice" data-kind={notice.kind}>
          <span className="calendar-notice-mark" aria-hidden="true">
            {notice.kind === "hint" ? "i" : notice.kind === "error" ? "!" : "✓"}
          </span>
          <span className="calendar-notice-message">{notice.message}</span>
          {(canUndoNotice || notice.action) && (
            <button
              type="button"
              className="calendar-notice-action"
              disabled={canUndoNotice && interaction.busy}
              onClick={() => {
                if (canUndoNotice) interaction.history.undo();
                else notice.action?.onClick();
                interaction.dismissNotice();
              }}
            >
              {canUndoNotice ? "Undo" : notice.action?.label}
            </button>
          )}
        </div>
      )}
      {interaction.selectedId && interaction.adjusting && (
        <div className="calendar-adjust-controls">
          <span>Drag the selected block</span>
          <div role="group" aria-label="Adjust block">
            {(["move", "start", "end"] as const).map((mode) => (
              <button
                className="button"
                key={mode}
                aria-pressed={interaction.selectedMode === mode}
                disabled={interaction.busy}
                onClick={() => interaction.setMode(mode)}
              >
                {mode === "move"
                  ? "Move"
                  : mode === "start"
                    ? "Resize start"
                    : "Resize end"}
              </button>
            ))}
            <button
              className="button"
              disabled={interaction.busy}
              onClick={interaction.finish}
            >
              Done
            </button>
          </div>
        </div>
      )}
      {interaction.status && (
        <p
          className={
            interaction.remove.needsRetry || interaction.command.needsRetry
              ? "calendar-status"
              : "sr-only"
          }
          role="status"
        >
          {interaction.remove.needsRetry
            ? "The deletion could not be confirmed. Retry the same change."
            : interaction.command.needsRetry
              ? "The adjustment could not be confirmed. Retry the same change."
              : interaction.status}
        </p>
      )}
      <CommandError command={interaction.history.command} />
      <CommandError command={interaction.command} />
      <CommandError command={interaction.remove} />
      <CommandError command={interaction.groupDelete} />
      <CommandError command={interaction.groupMove} />
      <CommandError command={interaction.itemAdjust} />
    </>
  );
  return container ? createPortal(content, container) : content;
}
