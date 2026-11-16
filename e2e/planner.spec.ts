import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { defaultState } from "../src/lib/model";
import { defaultPlanner } from "../src/lib/planner";
import { exportPlannerBackup } from "../src/lib/plannerBackup";
import { templateSchedule } from "../src/data/vesting";

async function openDetailed(page: Page) {
  await page.addInitScript(() => {
    window.sessionStorage.setItem("careerworth:mode", "detailed");
  });
  const button = page.getByRole("button", { name: /Add more detail/ });
  if (await button.isVisible()) {
    await button.click();
  }
}

test.beforeEach(async ({ page }) => {
  await openDetailed(page);
  await page.goto("/");
});

test("backup download contains the current plan", async ({ page }) => {
  await page.getByLabel("Annual base salary").fill("123456");
  const backup = page.locator("section").filter({ has: page.getByRole("heading", { name: "Back up your plan" }) });
  const downloading = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Download backup" }).click();
  const downloaded = await downloading;
  expect(downloaded.suggestedFilename()).toBe("careerworth-plan.json");
  const data = JSON.parse(await readFile((await downloaded.path())!, "utf8"));
  expect(data.planner.scenarios[0].base).toBe("123456");
});

test("backup restores a plan only after validation and confirmation", async ({ page }) => {
  const salary = page.getByLabel("Annual base salary");
  const backup = page.locator("section").filter({ has: page.getByRole("heading", { name: "Back up your plan" }) });
  const file = backup.locator('input[type="file"]');
  const plan = defaultPlanner();
  plan.scenarios[0].base = "123456";
  const data = Buffer.from(exportPlannerBackup(plan));
  await salary.fill("200000");
  page.once("dialog", (dialog) => dialog.dismiss());
  await file.setInputFiles({ name: "plan.json", mimeType: "application/json", buffer: data });
  await expect(salary).toHaveValue("200000");
  await expect(backup.getByRole("status")).toContainText("canceled");
  await file.setInputFiles({ name: "broken.json", mimeType: "application/json", buffer: Buffer.from("{broken") });
  await expect(backup.getByRole("status")).toContainText("not a valid");
  await expect(salary).toHaveValue("200000");
  page.once("dialog", (dialog) => dialog.accept());
  await file.setInputFiles({ name: "plan.json", mimeType: "application/json", buffer: data });
  await expect(salary).toHaveValue("123456");
  await page.reload();
  await expect(salary).toHaveValue("123456");
});

test("unified view defaults, inputs, progressive accordions and calculations", async ({
  page,
}) => {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/?mode=quick");
  await expect(
    page.getByRole("heading", { name: "Get a quick view of your financial future" }),
  ).toBeVisible();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("241000");
  await expect(page.getByLabel("Monthly living expenses")).toHaveValue("4500");
  await expect(page.getByLabel("Current invested savings")).toHaveValue("20000");
  await expect(page.getByLabel("Projection length")).toHaveValue("10");

  // Edit input
  await page.getByLabel("Annual base salary").fill("260000");
  await expect(page.getByLabel("Annual base salary")).toHaveValue("260000");

  // Verify progressive accordions are present and expandable
  const retirementAccordion = page.getByRole("group").filter({ hasText: "Retirement & Pretax Benefits" }).first();
  await expect(page.getByText("Retirement & Pretax Benefits")).toBeVisible();
  await expect(page.getByText("Taxes & Deductions")).toBeVisible();
  await expect(page.getByText("Equity Grants & Vesting Schedules")).toBeVisible();
  await expect(page.getByText("Career Moves & Promotions")).toBeVisible();
  await expect(page.getByText("Starting Accounts & Economic Assumptions")).toBeVisible();
});
test("quick presets preserve edits and full replacement requires confirmation", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/?mode=quick");
  const salary = page.getByLabel("Annual base salary");
  await expect(salary).toHaveValue("241000");
  await salary.fill("300001");
  await page.getByRole("group", { name: "Big Tech Company" }).getByRole("button", { name: "Meta" }).click();
  await expect(salary).toHaveValue("300001");
  await page.reload();
  await page.getByLabel("Location", { exact: true }).selectOption("seattle");
  await expect(salary).toHaveValue("300001");
  await page.getByRole("button", { name: "Preview full preset" }).click();
  const preview = page.getByRole("region", { name: "Full preset preview" });
  await expect(preview).toContainText("300001");
  await preview.getByRole("button", { name: "Cancel" }).click();
  await expect(salary).toHaveValue("300001");
  await page.getByRole("button", { name: "Preview full preset" }).click();
  await preview.getByRole("button", { name: "Apply full preset" }).click();
  await expect(salary).not.toHaveValue("300001");
});
test("switching company and level updates pay and stock when not manually customized", async ({ page }) => {
  await page.evaluate(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
  });
  await page.goto("/?mode=quick");
  const salary = page.getByLabel("Annual base salary");
  const stock = page.getByLabel("Annual stock / RSUs");
  await expect(salary).toHaveValue("241000");
  await expect(stock).toHaveValue("176000");

  // Switch to Meta: compensation should change to Meta E5
  await page.getByRole("group", { name: "Big Tech Company" }).getByRole("button", { name: "Meta" }).click();
  await expect(salary).toHaveValue("231000");
  await expect(stock).toHaveValue("225000");

  // Switch to Level E6: compensation should change to Meta E6
  await page.getByRole("group", { name: "Job Level" }).getByRole("button", { name: "E6" }).click();
  await expect(salary).toHaveValue("275000");
  await expect(stock).toHaveValue("380000");

  // Switch to Amazon: compensation should change to Amazon L6 (default senior level)
  await page.getByRole("group", { name: "Big Tech Company" }).getByRole("button", { name: "Amazon" }).click();
  await expect(salary).toHaveValue("218000");
  await expect(stock).toHaveValue("166000");

  // Reload page: switching company should still update pay
  await page.reload();
  await expect(salary).toHaveValue("218000");
  await page.getByRole("group", { name: "Big Tech Company" }).getByRole("button", { name: "Google" }).click();
  await expect(salary).toHaveValue("241000");
  await expect(stock).toHaveValue("176000");
});
test("quick forecast separates cash from sold stock and explains negative balances", async ({ page }) => {
  const plan = defaultPlanner();
  const scenario = plan.scenarios[0];
  scenario.base = "120000";
  scenario.tax = "0";
  scenario.taxProfile.mode = "manual";
  scenario.stock = "12000";
  scenario.includeStock = true;
  scenario.stockMode = "legacy";
  plan.shared.startYear = "2028";
  plan.shared.taxInflation = "4";
  await page.addInitScript((saved) => {
    localStorage.setItem("careerworth:v3", JSON.stringify(saved));
  }, plan);
  await page.goto("/");
  await expect(page.getByTestId("quick-cash-0")).toContainText("$8,000");
  await page.getByLabel("Monthly living expenses").fill("12000");
  await expect(page.getByTestId("quick-cash-0")).toContainText("-$1,000");
});
test("held stock stays out of spendable cash", async ({ page }) => {
  const plan = defaultPlanner();
  const scenario = plan.scenarios[0];
  scenario.base = "120000";
  scenario.tax = "0";
  scenario.taxProfile.mode = "manual";
  scenario.stock = "12000";
  scenario.includeStock = true;
  scenario.grants = [{ id: "held", name: "Held grant", issuerId: scenario.employerId, employmentId: "initial", month: "2026-01", units: "dollars", value: "48000", priceMode: "modeled", grantPrice: "100", schedule: templateSchedule("quarterly"), template: "quarterly", treatment: "hold", keepOnDeparture: false }];
  await page.addInitScript((saved) => {
    localStorage.setItem("careerworth:v3", JSON.stringify(saved));
  }, plan);
  await page.goto("/");
  await expect(page.getByTestId("quick-cash-0")).toContainText("$7,000");
  await page.getByLabel("Annual stock / RSUs").fill("30000");
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("careerworth:v3")!));
  expect(saved.scenarios[0].grants[0].value).toBe("48000");
});
test("calculated defaults, immediate edits, comparison, CSV and reset", async ({
  page,
}) => {
  const plan = defaultPlanner();
  await page.addInitScript((saved) => {
    localStorage.setItem("careerworth:v3", JSON.stringify(saved));
  }, plan);
  await page.goto("/");
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.getByRole("tab", { name: "Cash Flow & Budget" }).click();
  await expect(page.getByTestId("take-home-0")).toHaveText("$6,197");
  await expect(page.getByTestId("savings-0")).toHaveText("$3,197");
  const initial = await page.getByTestId("ending-0").textContent();
  await page.getByLabel("Annual base salary").fill("120000");
  await expect(page.getByLabel("Annual base salary")).toBeFocused();
  await expect(page.getByTestId("take-home-0")).toHaveText("$7,282");
  await expect(page.getByTestId("ending-0")).not.toHaveText(initial!);
  await page.getByRole("button", { name: "Add comparison" }).click();
  await expect(page.getByRole("button", { name: "Copy from Scenario A" })).toBeVisible();
  await expect(page.getByTestId("take-home-1")).toHaveText("$8,751");
  await expect(
    page.getByRole("img", { name: "Projected investment balance by year" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Annual Schedule" }).click();
  await expect(
    page
      .getByRole("table")
      .filter({
        has: page.locator("caption", { hasText: "Annual compensation" }),
      }),
  ).toHaveCount(2);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export CSV", exact: true }).click();
  const file = await download;
  expect(file.suggestedFilename()).toBe("careerworth-projection.csv");
  const csv = await readFile((await file.path())!, "utf8");
  expect(csv).toContain("Columbus offer");
  expect(csv).toContain("Seattle offer");
  expect(csv).toContain("Forfeited unvested equity");
  expect(csv.split("\r\n")).toHaveLength(23);
  await page.getByRole("tab", { name: "Cash Flow & Budget" }).click();
  await page.locator(".yearly-section summary").filter({ hasText: "Monthly cash flows & vesting" }).click();
  const monthly = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export monthly CSV" }).click();
  const monthlyFile = await monthly;
  expect(monthlyFile.suggestedFilename()).toBe("careerworth-monthly.csv");
  expect(
    (await readFile((await monthlyFile.path())!, "utf8")).split("\r\n"),
  ).toHaveLength(243);
  await page.getByRole("button", { name: "Reset inputs" }).click();
  await expect(page.getByTestId("savings-0")).toHaveText("$3,197");
  await expect(page.getByTestId("ending-1")).toHaveCount(0);
  expect(errors).toEqual([]);
});
test.skip("cash presets, independent tax location, budget edits and reload", async ({
  page,
}) => {
  await page.getByRole("group", { name: "Big Tech Company" }).getByRole("button", { name: "Apple" }).click();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("221000");
  await page.getByLabel("Annual base salary").fill("150001");
  await page
    .locator(".inputs-panel summary")
    .filter({ hasText: /^Taxes/ })
    .first()
    .click();
  await page
    .getByLabel("Tax residence and work location")
    .selectOption("new-york");
  await page
    .locator(".inputs-panel summary")
    .filter({ hasText: "Living Cost Breakdown" })
    .first()
    .click();
  await page.getByLabel("Location budget").selectOption("seattle");
  await expect(page.getByLabel("Monthly living expenses")).toHaveValue("3000");
  await page.getByRole("button", { name: "Apply budget" }).click();
  await expect(page.getByLabel("Tax residence and work location")).toHaveValue(
    "new-york",
  );
  await expect(page.getByLabel("Annual base salary")).toHaveValue("150001");
  await page.reload();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("150001");
  await page
    .locator(".inputs-panel summary")
    .filter({ hasText: /^Taxes/ })
    .first()
    .click();
  await expect(page.getByLabel("Tax residence and work location")).toHaveValue(
    "new-york",
  );
  await page
    .locator(".inputs-panel summary")
    .filter({ hasText: "Living Cost Breakdown" })
    .first()
    .click();
  await page.getByLabel("Food", { exact: false }).fill("600");
  await page.reload();
  await page
    .locator(".inputs-panel summary")
    .filter({ hasText: "Living Cost Breakdown" })
    .first()
    .click();
  await expect(page.getByLabel("Food", { exact: false })).toHaveValue("600");
});
test("equity schedule preview, held shares, progressive tax and custom row validation", async ({
  page,
}) => {
  await page.getByLabel("Projection length").fill("1");
  await page
    .locator("summary")
    .filter({ hasText: /^Equity grants / })
    .click();
  await page.getByRole("button", { name: "Add equity grant" }).click();
  await page.locator("summary").filter({ hasText: "New equity grant" }).click();
  await page.getByLabel("Total grant value").fill("100000");
  await page
    .getByLabel("Vested-share treatment", { exact: true })
    .selectOption("hold");
  await expect(page.getByTestId("stock-0")).toHaveText("$25,000");
  await expect(page.getByTestId("employerStock-0")).toHaveText("$16,211");
  await page.locator("summary").filter({ hasText: "Tax breakdown" }).click();
  await expect(page.getByTestId("equity-tax-0")).toHaveText("$8,789");
  await page.getByRole("button", { name: "Edit custom vesting rows" }).click();
  await page.getByLabel("Vesting row 1 percentage").fill("20");
  await expect(page.getByTestId("ending-0")).toHaveCount(0);
  await expect(
    page.getByText("Vesting percentages must total 100%.").first(),
  ).toBeVisible();
  await page.getByLabel("Vesting row 1 percentage").fill("25");
  await expect(page.getByLabel("Vesting row 1 percentage")).toBeFocused();
  await expect(page.getByTestId("ending-0")).toBeVisible();
  await page
    .getByText("Choose and preview a schedule", { exact: true })
    .click();
  await page
    .getByLabel("Vesting template", { exact: true })
    .selectOption("amazon-historical");
  await expect(page.getByTestId("stock-0")).toHaveText("$25,000");
  await page
    .getByRole("button", { name: "Apply schedule", exact: true })
    .click();
  await expect(page.getByTestId("stock-0")).toHaveText("$5,000");
  await page.reload();
  await expect(page.getByTestId("stock-0")).toHaveText("$5,000");
});
test("midyear promotions, new employers and role equity update annual and monthly results", async ({
  page,
}) => {
  await page
    .locator("summary")
    .filter({ hasText: /^Career progression / })
    .click();
  await page.getByRole("button", { name: "Add promotion" }).click();
  await page.locator("summary").filter({ hasText: "Next level" }).click();
  await page.getByLabel("Role starts in").fill("2026-07");
  await page.getByLabel("Expected annual base at role start").fill("200000");
  await page.getByLabel("Expected annual recurring bonus").fill("24000");
  await page
    .getByText("Promotion / new-hire equity award", { exact: true })
    .click();
  await page.getByLabel("New role total equity award").fill("40000");
  await page
    .locator("summary")
    .filter({ hasText: "Year-by-year projection" })
    .click();
  const annual = page
    .getByRole("table")
    .filter({
      has: page.locator("caption", { hasText: "Annual compensation" }),
    });
  await expect(
    annual.getByRole("cell", { name: "$150,000", exact: true }).first(),
  ).toBeVisible();
  await expect(
    annual.getByRole("cell", { name: "$12,000", exact: true }).first(),
  ).toBeVisible();
  await page.getByLabel("Results for calendar year").selectOption("1");
  await expect(page.getByTestId("stock-0")).toHaveText("$10,000");
  await page
    .getByRole("button", { name: "Change employer", exact: false })
    .click();
  await page.locator("summary").filter({ hasText: "New role" }).click();
  await expect(page.getByLabel("Career event type").last()).toHaveValue("job");
  await expect(
    page.getByLabel("Employer for this role").last(),
  ).not.toHaveValue("employer-initial");
  await page.reload();
  await expect(page.getByTestId("ending-0")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Career progression / })
    .click();
  await expect(
    page.locator("summary").filter({ hasText: "New role" }),
  ).toBeVisible();
});
test("household benefits, shared HSA validation, and healthcare offset", async ({
  page,
}) => {
  await page.getByText("Expense breakdown", { exact: true }).click();
  await page
    .getByRole("textbox", { name: "Healthcare", exact: true })
    .fill("1000");
  await page
    .locator("summary")
    .filter({ hasText: /^Taxes / })
    .click();
  await page.getByLabel("Filing status").selectOption("joint");
  await page.getByLabel("Spouse annual cash wages").fill("100000");
  await page
    .locator("summary")
    .filter({ hasText: /^Pretax benefits / })
    .click();
  await expect(
    page.getByLabel("Your annual payroll HSA contribution"),
  ).toHaveCount(0);
  await page
    .getByLabel("HSA eligible coverage (full year)")
    .selectOption("family");
  await expect(
    page.getByLabel("Your annual payroll HSA contribution"),
  ).toBeVisible();
  await page.getByLabel("Your 401(k) target type").selectOption("dollars");
  await page.getByLabel("Your annual 401(k) target").fill("12000");
  await page.getByLabel("Your annual pretax health premiums").fill("6000");
  await page.getByLabel("Your annual payroll HSA contribution").fill("4000");
  await page.getByLabel("Spouse annual payroll HSA contribution").fill("5000");
  await expect(page.getByTestId("ending-0")).toHaveCount(0);
  await expect(
    page
      .getByText(
        "Combined contributions exceed the projected household HSA limit.",
      )
      .first(),
  ).toBeVisible();
  await page.getByLabel("Spouse annual payroll HSA contribution").fill("4750");
  await expect(page.getByTestId("ending-0")).toBeVisible();
  await expect(page.getByTestId("traditional-401k-0")).not.toHaveText("$0");
  await expect(page.getByTestId("hsa-0")).not.toHaveText("$0");
  await page.reload();
  await page
    .locator("summary")
    .filter({ hasText: /^Pretax benefits / })
    .click();
  await expect(
    page.getByLabel("Your annual pretax health premiums"),
  ).toHaveValue("6000");
  await expect(
    page.getByLabel("Spouse annual payroll HSA contribution"),
  ).toHaveValue("4750");
});
test("invalid drafts pause results and exports; zero income and negative returns remain usable", async ({
  page,
}) => {
  await page.getByLabel("Annual base salary").fill("");
  await expect(
    page.getByText("A few details need a second look"),
  ).toBeVisible();
  await expect(page.getByTestId("ending-0")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Export CSV" })).toHaveCount(0);
  await page.getByLabel("Annual base salary").fill("0");
  await expect(page.getByTestId("take-home-0")).toHaveText("$0");
  await expect(page.getByTestId("savings-0")).toHaveText("-$3,000");
  await expect(page.getByText("N/A", { exact: true })).toBeVisible();
  await page.getByLabel("Projection length").fill("2.5");
  await expect(page.getByText("Use a whole number of years.")).toBeVisible();
  await page.getByLabel("Projection length").fill("40");
  await expect(page.getByTestId("ending-0")).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Assumptions / })
    .click();
  await page.getByLabel("Annual investment return").fill("-100");
  await expect(page.getByTestId("ending-0")).toHaveCount(0);
  await page.getByLabel("Annual investment return").fill("-50");
  await expect(page.getByTestId("ending-0")).toBeVisible();
  expect(await page.locator("body").innerText()).not.toMatch(/NaN|Infinity/);
});
test("v1 migration preserves inputs and supports explicit legacy equity conversion", async ({
  page,
}) => {
  const old = defaultState();
  old.scenarios[0].stock = "50000";
  old.scenarios[0].includeStock = true;
  await page.evaluate((old) => {
    localStorage.removeItem("careerworth:v3");
    localStorage.removeItem("careerworth:v2");
    localStorage.setItem("careerworth:v1", JSON.stringify(old));
  }, old);
  await page.reload();
  await openDetailed(page);
  await expect(
    page.getByText("Saved inputs upgraded.", { exact: false }).first(),
  ).toBeVisible();
  await expect(page.getByTestId("take-home-0")).toHaveText("$6,250");
  await expect(page.getByTestId("stock-0")).toHaveText("$50,000");
  await page
    .locator("summary")
    .filter({ hasText: /^Equity grants / })
    .click();
  await expect(page.getByLabel("Legacy annualized stock")).toHaveValue("50000");
  await page
    .getByRole("button", { name: "Replace legacy stock with this grant" })
    .click();
  await expect(page.getByLabel("Legacy annualized stock")).toHaveCount(0);
  await page.getByLabel("Results for calendar year").selectOption("4");
  await expect(page.getByTestId("stock-0")).toHaveText("$0");
  await page.reload();
  await expect(page.getByTestId("stock-0")).toHaveText("$50,000");
  expect(
    await page.evaluate(() => localStorage.getItem("careerworth:v1")),
  ).toBe(JSON.stringify(old));
});
test("malformed or unavailable storage does not break calculations", async ({
  page,
}) => {
  await page.evaluate(() => {
    localStorage.removeItem("careerworth:v3");
    localStorage.setItem("careerworth:v2", "{broken");
  });
  await page.reload();
  await expect(page.getByTestId("savings-0")).toHaveText("$3,197");
  await expect(
    page.getByText("Saved inputs could not be restored.", { exact: false }),
  ).toBeVisible();
  await page.addInitScript(() => {
    Object.defineProperty(window, "localStorage", {
      get: () => {
        throw Error("denied");
      },
    });
  });
  await page.reload();
  await openDetailed(page);
  await page.getByLabel("Annual base salary").fill("120000");
  await expect(page.getByTestId("take-home-0")).toHaveText("$7,282");
  await expect(
    page.getByText("Browser storage is unavailable.", { exact: false }),
  ).toBeVisible();
});
test("long names and expanded editors/tables fit phone, tablet and desktop widths", async ({
  page,
}, testInfo) => {
  await page
    .getByLabel("Scenario name")
    .fill(
      "A long engineering offer and planned career path "
        .repeat(3)
        .slice(0, 100),
    );
  await page.getByRole("button", { name: "Add comparison" }).click();
  await page
    .locator("summary")
    .filter({ hasText: /^Equity grants / })
    .click();
  await page.getByRole("button", { name: "Add equity grant" }).click();
  await page.locator("summary").filter({ hasText: "New equity grant" }).click();
  await page.getByRole("button", { name: "Edit custom vesting rows" }).click();
  await page
    .locator("summary")
    .filter({ hasText: "Year-by-year projection" })
    .click();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await page.getByRole("button", { name: "Reset inputs" }).click();
  await page.setViewportSize({
    width: testInfo.project.name === "mobile" ? 390 : 1440,
    height: 1000,
  });
  await page.screenshot({
    path: `test-results/${testInfo.project.name}-v2.png`,
    fullPage: true,
  });
});

test("keyboard controls open editors, switch scenarios and inspect chart years", async ({
  page,
}) => {
  const taxes = page.locator("summary").filter({ hasText: /^Taxes / });
  await taxes.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("Tax calculation")).toBeVisible();
  await page.getByLabel("Tax calculation").focus();
  await page.keyboard.press("m");
  await page.keyboard.press("Enter");
  const comparison = page.getByRole("button", { name: "Add comparison" });
  await comparison.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("ending-1")).toBeVisible();
  const range = page.getByRole("slider", { name: "Inspect projection year" });
  await range.focus();
  await page.keyboard.press("Home");
  await expect(range).toHaveValue("0");
  await page.keyboard.press("ArrowRight");
  await expect(range).toHaveValue("1");
});
