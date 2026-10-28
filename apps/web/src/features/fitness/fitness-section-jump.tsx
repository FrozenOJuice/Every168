"use client";

import { useCallback, useState } from "react";
import { ChevronDown } from "lucide-react";
import { ContextMenu } from "@/components/ui/context-menu";

const sections = [
  { id: "my-workouts", label: "My workouts" },
  { id: "training-programs", label: "Programs" },
  { id: "exercises", label: "Exercise library" },
];

export function FitnessSectionJump() {
  const [menu, setMenu] = useState<{
    anchor: HTMLButtonElement;
    x: number;
    y: number;
  } | null>(null);
  const close = useCallback(() => setMenu(null), []);
  function open(anchor: HTMLButtonElement) {
    const bounds = anchor.getBoundingClientRect();
    setMenu({ anchor, x: bounds.left, y: bounds.bottom + 4 });
  }
  return (
    <>
      <button
        type="button"
        className="button fitness-section-jump"
        aria-label="Jump to section"
        aria-haspopup="menu"
        aria-expanded={!!menu}
        onClick={(event) => (menu ? close() : open(event.currentTarget))}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown") {
            event.preventDefault();
            open(event.currentTarget);
          }
        }}
      >
        Jump to…
        <ChevronDown size={14} aria-hidden="true" />
      </button>
      {menu && (
        <ContextMenu
          {...menu}
          portalContainer={menu.anchor.closest("main") ?? undefined}
          anchorToggles
          label="Training sections"
          onClose={close}
          actions={sections.map(({ id, label }) => ({
            label,
            run: () => {
              const target = document.getElementById(id);
              target?.scrollIntoView({ block: "start" });
              target?.focus({ preventScroll: true });
            },
          }))}
        />
      )}
    </>
  );
}
