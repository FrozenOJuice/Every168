import type { Page } from "@playwright/test";

/** Navigate Food through its user-facing hierarchy, retaining the selected day. */
export async function foodView(page: Page, name: string) {
  name =
    (
      {
        "Foods & drinks": "Foods",
        "Saved meals": "Saved Meals",
        "Daily log": "Today",
        "My foods": "Library",
      } as Record<string, string>
    )[name] ?? name;
  const main = page.getByRole("navigation", {
    name: "Food navigation",
    exact: true,
  });
  if (["Foods", "Saved Meals", "Recipes"].includes(name)) {
    const area = main.getByRole("link", { name: "Library", exact: true });
    if ((await area.getAttribute("aria-current")) !== "page")
      await area.click();
    await page
      .getByRole("navigation", { name: "Library sections", exact: true })
      .getByRole("link", { name, exact: true })
      .click();
  } else if (name === "Search past entries") {
    await main.getByRole("link", { name: "Today", exact: true }).click();
    await page.getByRole("link", { name, exact: true }).click();
  } else await main.getByRole("link", { name, exact: true }).click();
}
