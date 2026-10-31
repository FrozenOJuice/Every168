import { expect, type Locator, type Page } from "@playwright/test";
type Root = Page | Locator;
const field = (root: Root, label: string) =>
  root.getByLabel(label, { exact: true });
const dateButton = (root: Root, label: string) =>
  root.getByRole("button", {
    name: ["Start", "End"].includes(label) ? `${label} date` : label,
    exact: true,
  });
function displayDate(value: string) {
  return new Date(value + "T12:00:00Z").toLocaleDateString("en", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}
export async function fillCalendarField(
  root: Root,
  label: string,
  value: string,
) {
  const button = dateButton(root, label);
  if (!(await button.count())) {
    await field(root, label).fill(value);
    return;
  }
  const date = value.slice(0, 10);
  await button.click();
  const picker = root.getByRole("dialog", { name: "Choose day", exact: true });
  const targetMonth = new Date(date + "T12:00:00Z").toLocaleDateString("en", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  });
  for (let i = 0; i < 24; i++) {
    const current = await picker
      .locator(".calendar-picker-header strong")
      .innerText();
    if (current === targetMonth) break;
    const currentTime = Date.parse(`1 ${current} UTC`);
    const targetTime = Date.parse(`${date.slice(0, 7)}-01T12:00:00Z`);
    await picker
      .getByRole("button", {
        name:
          currentTime < targetTime
            ? "Next picker month"
            : "Previous picker month",
        exact: true,
      })
      .click();
  }
  await picker
    .getByRole("button", { name: displayDate(date), exact: true })
    .click();
  if (!value.includes("T")) return;
  await root
    .getByRole("button", { name: `${label} time`, exact: true })
    .click();
  const time = root.getByRole("dialog", {
    name: `Choose ${label.toLowerCase()} time`,
    exact: true,
  });
  async function wheel(name: string, index: number) {
    const list = time.getByRole("listbox", { name, exact: true });
    await list.press("Home");
    for (let i = 0; i < Math.floor(index / 5); i++)
      await list.press("PageDown");
    for (let i = 0; i < index % 5; i++) await list.press("ArrowDown");
  }
  const hour = Number(value.slice(11, 13));
  await wheel("Hour", (hour % 12 || 12) - 1);
  await wheel("Minute", Number(value.slice(14, 16)));
  await time
    .getByRole("listbox", { name: "AM/PM", exact: true })
    .press(hour >= 12 ? "End" : "Home");
  await time.getByRole("button", { name: "Set time", exact: true }).click();
}
export async function expectCalendarField(
  root: Root,
  label: string,
  value: string | RegExp,
) {
  if (
    label === "Repeat" &&
    (await root
      .getByRole("radiogroup", { name: "Repeat", exact: true })
      .count())
  ) {
    await expect(
      root.getByRole("radio", {
        name: repeatLabels[String(value)],
        exact: true,
      }),
    ).toBeChecked();
    return;
  }
  const button = dateButton(root, label);
  if (!(await button.count())) {
    await expect(field(root, label)).toHaveValue(value);
    return;
  }
  async function read() {
    const date = new Date((await button.innerText()).trim() + " UTC")
      .toISOString()
      .slice(0, 10);
    if (!["Start", "End"].includes(label)) return date;
    const time = (
      await root
        .getByRole("button", { name: `${label} time`, exact: true })
        .innerText()
    ).trim();
    const match = /^(\d+):(\d+) (AM|PM)$/.exec(time)!;
    return `${date}T${String((Number(match[1]) % 12) + (match[3] === "PM" ? 12 : 0)).padStart(2, "0")}:${match[2]}`;
  }
  if (typeof value === "string") await expect.poll(read).toBe(value);
  else await expect.poll(read).toMatch(value);
}
const repeatLabels: Record<string, string> = {
  never: "Doesn’t repeat",
  daily: "Daily",
  weekly: "Weekly",
  custom: "Custom",
};
export async function selectCalendarRepeat(root: Root, value: string) {
  if (
    await root.getByRole("radiogroup", { name: "Repeat", exact: true }).count()
  )
    await root
      .getByRole("radio", { name: repeatLabels[value], exact: true })
      .check();
  else await field(root, "Repeat").selectOption(value);
}
export async function showCalendarNotes(root: Root) {
  const disclosure = root.getByText("More details", { exact: true });
  if (await disclosure.count()) await disclosure.click();
  else await expect(root.getByLabel("Notes (optional)")).toBeVisible();
}

export async function saveCalendarPlan(root: Root) {
  const save = root.getByRole("button", { name: "Save", exact: true });
  if (await save.count()) await save.click();
  else
    await root
      .getByRole("button", { name: "Create repeating plan", exact: true })
      .click();
}

export async function openCalendarPlan(root: Root) {
  await root.getByRole("button", { name: "Add", exact: true }).click();
  await root
    .getByRole("menu", { name: "Add to Calendar", exact: true })
    .getByRole("menuitem", { name: "Add plan", exact: true })
    .click();
}

export async function openCalendarEditorActions(root: Root) {
  const trigger = root.getByRole("button", {
    name: /^(Plan actions|Recorded time actions|Repeating plan actions)$/,
  });
  if (await trigger.count()) await trigger.click();
  else await root.getByText("Actions", { exact: true }).click();
}
export async function clickCalendarEditorAction(root: Root, label: string) {
  const currentLabel = label === "Delete block" ? "Delete plan" : label;
  const item = root.getByRole("menuitem", { name: currentLabel, exact: true });
  if (await item.count()) await item.click();
  else {
    const button = root.getByRole("button", { name: label, exact: true });
    if (await button.count()) await button.click();
    else {
      await openCalendarEditorActions(root);
      await item.click();
    }
  }
}

export async function selectCalendarChoice(
  root: Root,
  label: string,
  value: string,
) {
  const group = root.getByRole("radiogroup", { name: label, exact: true });
  const labels: Record<string, string> = {
    day: "Day",
    week: "Week",
    range: "Date range",
    daily: "Daily",
    weekly: "Weekly",
  };
  if (await group.count())
    await group
      .getByRole("radio", { name: labels[value], exact: true })
      .check();
  else await field(root, label).selectOption(value);
}
export async function expectCalendarClock(
  root: Root,
  label: string,
  value: string,
) {
  const button = root.getByRole("button", { name: label, exact: true });
  if (!(await button.count())) {
    await expect(field(root, label)).toHaveValue(value);
    return;
  }
  await expect(button).toHaveText(
    `${Number(value.slice(0, 2)) % 12 || 12}:${value.slice(3)} ${Number(value.slice(0, 2)) >= 12 ? "PM" : "AM"}`,
  );
}
