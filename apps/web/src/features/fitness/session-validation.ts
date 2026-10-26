import { workoutUpdateInput } from "@168hours/contracts";
import { sessionInput, type SessionDraft } from "./strength-draft";
export function sessionErrors(input: SessionDraft): Record<string, string> {
  const parsed = workoutUpdateInput.safeParse(sessionInput(input));
  if (parsed.success) return {};
  return Object.fromEntries(
    parsed.error.issues.map((issue) => [issue.path.join("."), issue.message]),
  );
}
export function focusSessionError(root: HTMLElement | null) {
  const field = Array.from(
    root?.querySelectorAll<HTMLElement>(
      '[aria-invalid="true"], [data-invalid="true"], [data-validation-error="true"]',
    ) ?? [],
  ).find((e) => !e.closest("[hidden]"));
  if (!field) return;
  let parent = field.parentElement;
  while (parent) {
    if (parent instanceof HTMLDetailsElement) parent.open = true;
    parent = parent.parentElement;
  }
  const collapsed = field.closest<HTMLElement>("[inert][id]");
  if (collapsed) {
    root
      ?.querySelector<HTMLButtonElement>(
        `[aria-controls="${CSS.escape(collapsed.id)}"]`,
      )
      ?.click();
    requestAnimationFrame(() => field.focus());
  } else field.focus();
}
