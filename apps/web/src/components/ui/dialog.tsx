"use client";
import { useCallback, useLayoutEffect, useRef, useId } from "react";
import { X } from "lucide-react";
export function Dialog({
  title,
  onClose,
  children,
  dialogRef,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  dialogRef?: (element: HTMLDialogElement | null) => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const attach = useCallback(
    (element: HTMLDialogElement | null) => {
      ref.current = element;
      dialogRef?.(element);
    },
    [dialogRef],
  );
  useLayoutEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (opener instanceof HTMLElement && opener.isConnected)
        opener.focus({ preventScroll: true });
    };
  }, []);
  return (
    <dialog
      ref={attach}
      aria-labelledby={titleId}
      onCancel={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClose();
      }}
      className="dialog"
    >
      <div className="row between dialog-heading">
        <h2 id={titleId}>{title}</h2>
        <button
          type="button"
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          <X size={20} />
        </button>
      </div>
      {children}
    </dialog>
  );
}
