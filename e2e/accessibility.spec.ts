import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

for (const route of ["/", "/privacy.html", "/terms.html", "/accessibility.html"]) {
  test(`has no WCAG 2.2 AA accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();

    expect(
      results.violations.map(({ id, impact, description, nodes }) => ({
        id,
        impact,
        description,
        elements: nodes.map(({ target, failureSummary }) => ({ target, failureSummary })),
      })),
    ).toEqual([]);
  });
}
