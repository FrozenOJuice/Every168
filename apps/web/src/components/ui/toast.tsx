"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

export type ToastNotice = {
  id: number;
  message: string;
  kind?: "success" | "info" | "error";
  action?: { label: string; onClick: () => void; disabled?: boolean };
};

// State belongs to the active surface, including Calendar's fullscreen dialog.
export function useToast<T extends { id: number } = ToastNotice>() {
  const [notice, setNotice] = useState<T | null>(null);
  const sequence = useRef(0);
  const show = useCallback((value: Omit<T, "id">) => {
    const id = ++sequence.current;
    setNotice({ ...value, id } as T);
    return id;
  }, []);
  const dismiss = useCallback((id?: number) => {
    setNotice((current) =>
      id === undefined || current?.id === id ? null : current,
    );
  }, []);
  return { notice, show, dismiss };
}

export function Toast({
  message,
  kind = "info",
  action,
  onDismiss,
  durationMs,
}: Omit<ToastNotice, "id"> & { onDismiss: () => void; durationMs?: number }) {
  const duration =
    durationMs ?? (action ? 5000 : kind === "success" ? 2400 : 4000);
  const remaining = useRef(duration);
  const dismiss = useRef(onDismiss);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    dismiss.current = onDismiss;
  }, [onDismiss]);
  useEffect(() => {
    if (hovered || focused) return;
    const started = Date.now();
    const timer = window.setTimeout(() => dismiss.current(), remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(
        0,
        remaining.current - (Date.now() - started),
      );
    };
  }, [hovered, focused]);
  return (
    <div
      className="app-toast"
      data-kind={kind}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.preventDefault();
          event.stopPropagation();
          onDismiss();
        }
      }}
    >
      <span className="app-toast-mark" aria-hidden="true">
        {kind === "info" ? "i" : kind === "error" ? "!" : "✓"}
      </span>
      <span
        className="app-toast-message"
        role={kind === "error" ? "alert" : "status"}
        aria-atomic="true"
      >
        {message}
      </span>
      {action && (
        <button
          type="button"
          className="app-toast-action"
          disabled={action.disabled}
          onClick={() => {
            action.onClick();
            onDismiss();
          }}
        >
          {action.label}
        </button>
      )}
      <button
        type="button"
        className="app-toast-dismiss"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        <X size={14} aria-hidden="true" />
      </button>
    </div>
  );
}
