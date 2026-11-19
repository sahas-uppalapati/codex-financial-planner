import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { defaultPlanner } from "../src/lib/planner";

async function navigate(page: import("@playwright/test").Page, name: string) {
  await page
    .getByRole("navigation", { name: "Results navigation" })
    .getByRole("button", { name, exact: true })
    .click();
}
test.beforeEach(async ({ page }) => {
  const plan = defaultPlanner();
  plan.shared = {
    ...plan.shared,
    starting: "20000",
    years: "2",
    returns: "0",
    inflation: "0",
    taxInflation: "0",
  };
  plan.comparison = true;
  plan.scenarios.forEach((scenario, index) => {
    scenario.base = index === 0 ? "12000" : "24000";
    scenario.bonus = "0";
    scenario.stock = "0";
    scenario.growth = "0";
    scenario.taxProfile.mode = "manual";
    scenario.tax = "0";
    scenario.expenses = {
      housing: "0",
      food: "0",
      healthcare: "0",
      transportation: "0",
      other: "0",
    };
    scenario.employerMatch.type = "none";
  });
  await page.goto("/");
  await page.evaluate(
    (plan) => localStorage.setItem("careerworth:v3", JSON.stringify(plan)),
    plan,
  );
  await page.reload();
});

test("standalone calculators support all five modes, keyboard use, and navigation drafts", async ({
  page,
}, testInfo) => {
  await navigate(page, "Calculators");
  await expect(page.getByRole("heading", { name: "Investment calculators" })).toBeFocused();
  const form = page.getByRole("complementary", {
    name: "Investment calculator inputs",
  });
  const tabs = page.getByRole("tablist", { name: "Calculator type" });
  await expect(tabs.getByRole("tab")).toHaveCount(5);
  await tabs
    .getByRole("tab", { name: "Ending balance", exact: true })
    .press("ArrowRight");
  await expect(
    tabs.getByRole("tab", { name: "Monthly saving needed", exact: true }),
  ).toBeFocused();
  await tabs
    .getByRole("tab", { name: "Monthly saving needed", exact: true })
    .press("End");
  await expect(
    tabs.getByRole("tab", { name: "Required return", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await tabs
    .getByRole("tab", { name: "Required return", exact: true })
    .press("Home");
  await form.getByLabel("Starting investments", { exact: false }).fill("1000");
  await form.getByLabel("Monthly contribution", { exact: false }).fill("100");
  await form.getByLabel("Annual investment return", { exact: false }).fill("0");
  await form.getByLabel("Investment length", { exact: false }).fill("1");
  await form.getByLabel("Investment length", { exact: false }).press("Enter");
  const answer = page.getByTestId("calculator-answer-0");
  await expect(answer).toHaveText("$2,200");
  await page
    .getByRole("tab", { name: "Monthly saving needed", exact: true })
    .click();
  await form
    .getByLabel("Target investment balance", { exact: false })
    .fill("3000");
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(answer).toHaveText("$166.67");
  await page.getByRole("tab", { name: "Time to target", exact: true }).click();
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(answer).toHaveText("1 year, 8 months");
  await page
    .getByRole("tab", { name: "Starting balance needed", exact: true })
    .click();
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(answer).toHaveText("$1,800.00");
  await page.getByRole("tab", { name: "Required return", exact: true }).click();
  await form
    .getByLabel("Target investment balance", { exact: false })
    .fill("2200");
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(answer).toContainText("%");
  expect(Math.abs(parseFloat((await answer.textContent())!))).toBeLessThan(
    0.0001,
  );
  await page.getByText("Annual balance schedule", { exact: true }).click();
  await expect(page.getByRole("table")).toBeVisible();
  const accessibility = await new AxeBuilder({ page })
    .include(".investment-calculators")
    .analyze();
  expect(accessibility.violations).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `/tmp/careerworth-calculators-${testInfo.project.name}.png`,
    fullPage: true,
  });
  await navigate(page, "Overview");
  await navigate(page, "Calculators");
  await expect(
    form.getByLabel("Target investment balance", { exact: false }),
  ).toHaveValue("2200");
  await page.reload();
  await navigate(page, "Calculators");
  await expect(
    page.getByRole("tab", { name: "Ending balance", exact: true }),
  ).toHaveAttribute("aria-selected", "true");
  await navigate(page, "Overview");
  await page.getByLabel("Annual base salary", { exact: false }).fill("invalid");
  await navigate(page, "Calculators");
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(answer).toBeVisible();
  await form.getByLabel("Input source").selectOption("career");
  await expect(
    form.getByRole("button", { name: "Calculate", exact: true }),
  ).toBeDisabled();
});

test("career calculators run in a worker, compare plans, and preserve saved inputs", async ({
  page,
}) => {
  await expect(page.getByTestId("ending-0")).toHaveText("$44,000");
  const saved = await page.evaluate(() =>
    localStorage.getItem("careerworth:v3"),
  );
  await page
    .getByRole("button", { name: "Explore calculators", exact: true })
    .click();
  const form = page.getByRole("complementary", {
    name: "Investment calculator inputs",
  });
  await expect(form.getByLabel("Input source")).toHaveValue("career");
  await form.getByLabel("Investment length", { exact: false }).fill("1");
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByTestId("calculator-answer-0")).toHaveText("$32,000");
  await expect(page.getByTestId("calculator-answer-1")).toHaveText("$44,000");
  await page
    .getByRole("tab", { name: "Monthly saving needed", exact: true })
    .click();
  await form
    .getByLabel("Target investment balance", { exact: false })
    .fill("68000");
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByTestId("calculator-answer-0")).toHaveText("$3,000.00");
  await expect(page.getByTestId("calculator-answer-1")).toHaveText("$2,000.00");
  expect(
    await page.evaluate(() => localStorage.getItem("careerworth:v3")),
  ).toBe(saved);
  await page.getByRole("tab", { name: "Time to target", exact: true }).click();
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  // Editing the request invalidates any in-flight worker response.
  await form
    .getByLabel("Target investment balance", { exact: false })
    .fill("50000");
  await expect(page.getByTestId("calculator-answer-0")).toHaveCount(0);
  await form.getByRole("button", { name: "Calculate", exact: true }).click();
  await expect(page.getByTestId("calculator-answer-0")).toHaveText(
    "2 years, 6 months",
  );
  await form
    .getByRole("button", { name: "Edit career plan", exact: true })
    .click();
  await expect(page.getByTestId("ending-0")).toHaveText("$44,000");
});
