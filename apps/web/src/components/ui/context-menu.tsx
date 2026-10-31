"use client";

import { useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";

export type ContextMenuAction =
  | {
      label: string;
      description?: string;
      shortcut?: string;
      disabled?: boolean;
      destructive?: boolean;
      run: () => void;
    }
  | { separator: true };

export function ContextMenu({
  x,
  y,
  anchor,
  actions,
  onClose,
  label = "Calendar actions",
  portalContainer,
  className,
  anchorToggles = false,
}: {
  x: number;
  y: number;
  anchor: HTMLElement;
  actions: ContextMenuAction[];
  onClose: () => void;
  label?: string;
  portalContainer?: Element;
  className?: string;
  anchorToggles?: boolean;
}) {
  const menu = useRef<HTMLDivElement>(null);
  const dialog = anchor.closest("dialog[open]");
  // Explicit containers within a native dialog preserve nested popover dismissal;
  // containers outside it must not move the menu out of the active top layer.
  const target =
    portalContainer && (!dialog || dialog.contains(portalContainer))
      ? portalContainer
      : (dialog ?? document.body);
  useLayoutEffect(() => {
    const element = menu.current!;
    const bounds = element.getBoundingClientRect();
    element.style.left = `${Math.max(8, Math.min(x, window.innerWidth - bounds.width - 8))}px`;
    element.style.top = `${Math.max(8, Math.min(y, window.innerHeight - bounds.height - 8))}px`;
    element
      .querySelector<HTMLButtonElement>("button:not(:disabled)")
      ?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      if (anchorToggles && anchor.contains(event.target as Node)) return;
      if (!element.contains(event.target as Node)) onClose();
    }
    function dismiss() {
      onClose();
    }
    document.addEventListener("pointerdown", outside, true);
    window.addEventListener("resize", dismiss);
    window.addEventListener("blur", dismiss);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("resize", dismiss);
      window.removeEventListener("blur", dismiss);
    };
  }, [x, y, anchor, onClose, anchorToggles]);
  function closeAndFocus() {
    onClose();
    if (anchor.isConnected) anchor.focus({ preventScroll: true });
  }
  return createPortal(
    <div
      ref={menu}
      role="menu"
      aria-label={label}
      className={`context-menu${className ? ` ${className}` : ""}`}
      style={{ left: x, top: y }}
      onContextMenu={(event) => event.preventDefault()}
      onKeyDown={(event) => {
        // Keep Calendar shortcuts from acting on a selection behind the menu.
        event.stopPropagation();
        if (event.repeat || event.nativeEvent.isComposing || event.altKey)
          return;
        const key = event.key.toLowerCase();
        const modified = event.metaKey || event.ctrlKey;
        const label = modified
          ? key === "c" && !event.shiftKey
            ? "Copy"
            : key === "v" && !event.shiftKey
              ? "Paste"
              : key === "z"
                ? event.shiftKey
                  ? "Redo"
                  : "Undo"
                : key === "y" &&
                    event.ctrlKey &&
                    !event.metaKey &&
                    !event.shiftKey
                  ? "Redo"
                  : null
          : !event.shiftKey && (key === "delete" || key === "backspace")
            ? "Delete"
            : !event.shiftKey && key === "r"
              ? "Reset zoom"
              : null;
        if (label) {
          const action = actions.find(
            (action) =>
              !("separator" in action) &&
              (action.label === label || action.label.startsWith(`${label} `)),
          );
          event.preventDefault();
          if (action && !("separator" in action) && !action.disabled) {
            closeAndFocus();
            action.run();
          }
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          closeAndFocus();
        } else if (event.key === "Tab") {
          event.preventDefault();
          closeAndFocus();
        } else if (
          ["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)
        ) {
          event.preventDefault();
          const buttons = [
            ...menu.current!.querySelectorAll<HTMLButtonElement>(
              "button:not(:disabled)",
            ),
          ];
          const current = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            event.key === "Home"
              ? 0
              : event.key === "End"
                ? buttons.length - 1
                : (current +
                    (event.key === "ArrowDown" ? 1 : -1) +
                    buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      {actions.map((action, index) =>
        "separator" in action ? (
          <div role="separator" key={`separator-${index}`} />
        ) : (
          <button
            key={`${index}-${action.label}`}
            type="button"
            role="menuitem"
            tabIndex={-1}
            disabled={action.disabled}
            data-destructive={action.destructive || undefined}
            onPointerMove={(event) => {
              if (!action.disabled)
                event.currentTarget.focus({ preventScroll: true });
            }}
            onClick={() => {
              closeAndFocus();
              action.run();
            }}
          >
            <span>
              {action.label}
              {action.description && (
                <span className="context-menu-description">
                  {action.description}
                </span>
              )}
            </span>
            {action.shortcut && <kbd aria-hidden="true">{action.shortcut}</kbd>}
          </button>
        ),
      )}
    </div>,
    target,
  );
}
