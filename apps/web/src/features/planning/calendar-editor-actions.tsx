"use client";
import { useCallback, useState } from "react";
import { MoreHorizontal } from "lucide-react";
import {
  ContextMenu,
  type ContextMenuAction,
} from "@/components/ui/context-menu";
export function CalendarEditorActions({
  actions,
  disabled,
  label,
}: {
  actions: ContextMenuAction[];
  disabled: boolean;
  label: string;
}) {
  const [anchor, setAnchor] = useState<HTMLButtonElement | null>(null);
  const close = useCallback(() => setAnchor(null), []);
  return (
    <>
      <button
        type="button"
        className="icon-button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={!!anchor && !disabled}
        disabled={disabled}
        onClick={(event) => setAnchor(anchor ? null : event.currentTarget)}
      >
        <MoreHorizontal size={18} aria-hidden="true" />
      </button>
      {anchor && !disabled && (
        <ContextMenu
          anchor={anchor}
          x={anchor.getBoundingClientRect().right - 224}
          y={anchor.getBoundingClientRect().bottom + 4}
          label={label}
          actions={actions}
          onClose={close}
          anchorToggles
          portalContainer={
            anchor.closest(".calendar-plan-popover") ?? undefined
          }
        />
      )}
    </>
  );
}
