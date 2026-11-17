import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";

async function audit(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(
    results.violations.map(({ id, impact, nodes }) => ({
      id,
      impact,
      elements: nodes.map(({ target, failureSummary }) => ({
        target,
        failureSummary,
      })),
    })),
  ).toEqual([]);
}

for (const route of [
  "/",
  "/privacy.html",
  "/terms.html",
  "/accessibility.html",
]) {
  test(`has no WCAG 2.2 AA accessibility violations on ${route}`, async ({
    page,
  }) => {
    await page.goto(route);
    await audit(page);
    if (route !== "/") return;
    test.setTimeout(90000);
    await page.getByRole("button", { name: "Add comparison" }).click();
    await page.getByRole("button", { name: "Expand all sections" }).click();
    await page.getByLabel("This is a startup offer").check();
    for (const theme of ["light", "dark"]) {
      await page.getByLabel("Appearance").selectOption(theme);
      await audit(page);
      await page
        .getByRole("navigation", { name: "Results navigation" })
        .getByRole("button", { name: "Taxes", exact: true })
        .click();
      await audit(page);
      await page
        .getByRole("navigation", { name: "Results navigation" })
        .getByRole("button", { name: "Overview", exact: true })
        .click();
    }
    await page.getByLabel("This is a startup offer").uncheck();
    await page
      .locator("summary")
      .filter({ hasText: "Company presets" })
      .click();
    await page.getByRole("button", { name: "Preview full preset" }).click();
    await audit(page);
    await page.keyboard.press("Escape");
    await expect(
      page.getByRole("button", { name: "Preview full preset" }),
    ).toBeFocused();
  });
}
