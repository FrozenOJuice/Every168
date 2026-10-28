"use client";
import { Dialog } from "@/components/ui/dialog";
export function FitnessConfirm({
  title,
  description,
  action,
  cancel = "Keep editing",
  danger = false,
  busy = false,
  onCancel,
  onConfirm,
  extraAction,
  children,
}: {
  title: string;
  description?: string;
  action: string;
  cancel?: string;
  danger?: boolean;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  extraAction?: { label: string; disabled?: boolean; onClick: () => void };
  children?: React.ReactNode;
}) {
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      <div className="fitness-confirm-content">
        {description && <p className="muted">{description}</p>}
        <div
          className="fitness-confirm-actions"
          data-extra-action={!!extraAction}
        >
          <button
            type="button"
            className="button"
            disabled={busy}
            onClick={onCancel}
          >
            {cancel}
          </button>
          <button
            type="button"
            className={`button ${danger ? "danger" : "primary"}`}
            disabled={busy}
            onClick={onConfirm}
          >
            {action}
          </button>
          {extraAction && (
            <button
              type="button"
              className="button primary"
              disabled={busy || extraAction.disabled}
              onClick={extraAction.onClick}
            >
              {extraAction.label}
            </button>
          )}
        </div>
        {children}
      </div>
    </Dialog>
  );
}
