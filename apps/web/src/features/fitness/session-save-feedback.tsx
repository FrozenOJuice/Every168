"use client";

export function SessionSaveFeedback({
  error,
  conflict,
  needsRetry,
  retrying = false,
  onRetry,
  onReload,
}: {
  error: Error | null;
  conflict: boolean;
  needsRetry: boolean;
  retrying?: boolean;
  onRetry?: () => void;
  onReload: () => void;
}) {
  if (!error && !conflict) return null;
  return (
    <div className="fitness-session-save-feedback" role="alert">
      <div>
        <strong>
          {conflict
            ? "Workout changed elsewhere"
            : needsRetry
              ? "Save not confirmed"
              : "Changes not saved"}
        </strong>
        <p>
          {conflict
            ? "Your edits are kept here. Reload the latest workout to continue."
            : needsRetry
              ? "We couldn't confirm your last save. Retry save to check it safely."
              : error?.message}
        </p>
      </div>
      {conflict ? (
        <button className="button" onClick={onReload}>
          Reload latest
        </button>
      ) : onRetry ? (
        <button
          className="button primary"
          disabled={retrying}
          onClick={onRetry}
        >
          {retrying ? "Saving…" : "Retry save"}
        </button>
      ) : null}
    </div>
  );
}
