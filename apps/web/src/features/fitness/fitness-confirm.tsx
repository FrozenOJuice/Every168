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
  children?: React.ReactNode;
}) {
  return (
    <Dialog
      title={title}
      onClose={() => {
        if (!busy) onCancel();
      }}
    >
      {description && <p className="muted">{description}</p>}
      <div className="fitness-confirm-actions">
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
      </div>
      {children}
    </Dialog>
  );
}
