import { createPortal } from "react-dom";
import type { Gesture, Preview } from "./calendar-interaction-types";
export function CalendarDragPreview({
  preview,
  gesture,
}: {
  preview: Preview | null;
  gesture: Gesture | null;
}) {
  return (
    <>
      {" "}
      {preview?.moving &&
        createPortal(
          <>
            {preview.moving.map((plan) => (
              <div
                key={plan.key}
                className="calendar-moving-block"
                aria-hidden="true"
                style={plan.bounds}
              >
                <strong>{plan.title}</strong>
                <span>{plan.label}</span>
                <small className="calendar-drag-hint">Escape to cancel</small>
              </div>
            ))}
          </>,
          document.body,
        )}
      {!preview?.moving &&
        preview?.bounds &&
        gesture?.block &&
        gesture.mode === "move" &&
        createPortal(
          <div
            className="calendar-moving-block"
            aria-hidden="true"
            style={preview.bounds}
          >
            <strong>{gesture.block.title}</strong>
            <span>{preview.label}</span>
            <small className="calendar-drag-hint">Escape to cancel</small>
          </div>,
          document.body,
        )}
      {preview && (
        <span className="sr-only" role="status">
          {preview.label} · Escape to cancel
        </span>
      )}
    </>
  );
}
