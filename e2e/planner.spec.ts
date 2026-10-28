import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { defaultState } from "../src/lib/model";

async function openDetailed(page: Page) {
  const button = page.getByRole("button", { name: /Add more detail/ });
  if (await button.isVisible()) {
    await button.click();
  }
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await openDetailed(page);
});

test("quick estimate mode defaults, inputs, assumptions and transitions", async ({
  page,
}) => {
  await page.goto("/");
  const back = page.getByRole("button", { name: /Back to quick estimate/ });
  if (await back.isVisible()) {
    await back.click();
  }
  await expect(
    page.getByRole("heading", { name: "Get a quick view of your financial future" }),
  ).toBeVisible();
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("100000");
  await expect(page.getByLabel("Monthly living costs")).toHaveValue("3000");
  await expect(page.getByLabel("Current invested savings")).toHaveValue("20000");
  await expect(page.getByLabel("Years to project")).toHaveValue("10");
  await expect(page.getByTestId("take-home-0")).toHaveText("$6,197");
  await expect(page.getByTestId("savings-0")).toHaveText("$3,197");

  // Edit quick input
  await page.getByLabel("Annual salary before tax").fill("120000");
  await expect(page.getByTestId("take-home-0")).toHaveText("$7,282");

  // Open assumptions drawer
  await page.locator("summary").filter({ hasText: /^Assumptions:/ }).click();
  await page.getByLabel("Filing status").selectOption("joint");
  await page.getByLabel("Spouse annual salary").fill("50000");

  // Transition to detailed view
  await page.getByRole("button", { name: "Add more detail" }).click();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("120000");
  await expect(
    page.getByRole("button", { name: "← Back to quick estimate" }),
  ).toBeVisible();

  // Return to quick view
  await page.getByRole("button", { name: "← Back to quick estimate" }).click();
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("120000");
});
test("calculated defaults, immediate edits, comparison, CSV and reset", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await expect(page.getByTestId("take-home-0")).toHaveText("$6,197");
  await expect(page.getByTestId("savings-0")).toHaveText("$3,197");
  const initial = await page.getByTestId("ending-0").textContent();
  await page.getByLabel("Annual base salary").fill("120000");
  await expect(page.getByLabel("Annual base salary")).toBeFocused();
  await expect(page.getByTestId("take-home-0")).toHaveText("$7,282");
  await expect(page.getByTestId("ending-0")).not.toHaveText(initial!);
  await page.getByRole("button", { name: "Add comparison" }).click();
  await expect(page.getByTestId("take-home-1")).toHaveText("$8,751");
  await expect(
    page.getByRole("img", { name: "Projected investment balance by year" }),
  ).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: "Year-by-year projection" })
    .click();
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
  await page
    .locator("summary")
    .filter({ hasText: "Monthly cash flows & vesting" })
    .click();
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
test("cash presets, independent tax location, budget edits and reload", async ({
  page,
}) => {
  await page.getByText("Start with a company preset").click();
  await page.getByLabel("Company", { exact: true }).selectOption("Apple");
  await expect(page.getByLabel("Annual base salary")).toHaveValue("100000");
  await page.getByRole("button", { name: "Apply pay and progression", exact: true }).click();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("142000");
  await expect(page.getByTestId("stock-0")).toHaveText("$25,300");
  await page.getByLabel("Annual base salary").fill("150001");
  await expect(page.getByText("Customized", { exact: true })).toBeVisible();
  await page
    .locator("summary")
    .filter({ hasText: /^Taxes / })
    .click();
  await page
    .getByLabel("Tax residence and work location")
    .selectOption("new-york");
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
    .locator("summary")
    .filter({ hasText: /^Taxes / })
    .click();
  await expect(page.getByLabel("Tax residence and work location")).toHaveValue(
    "new-york",
  );
  await page.getByText("Expense breakdown", { exact: true }).click();
  await page.getByLabel("Food", { exact: false }).fill("600");
  await page.reload();
  await page.getByText("Expense breakdown", { exact: true }).click();
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
    .getByRole("textbox", { name: "Healthcare USD / month", exact: true })
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
  await page
    .getByLabel("HSA eligible coverage (full year)")
    .selectOption("family");
  await page.getByLabel("Your annual traditional 401(k)").fill("12000");
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
  await expect(page.getByTestId("retirement-0")).not.toHaveText("$0");
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
  await page.evaluate(() => localStorage.setItem("careerworth:v2", "{broken"));
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
