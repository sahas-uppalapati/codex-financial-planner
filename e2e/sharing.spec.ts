import { expect, test } from "@playwright/test";
import { emptyStartupSession } from "../src/lib/startupComparison";

test("explicit links preview and require confirmation", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await page.getByLabel("Annual base salary").fill("185000");
  await page.getByLabel("This is a startup offer").check();
  await page.getByLabel("Number of options").fill("1234");
  await page.getByRole("button", { name: "Share", exact: true }).click();
  await expect(
    page.getByText("Anyone with the link can read them.", { exact: false }),
  ).toBeVisible();
  await page.context().grantPermissions(["clipboard-read", "clipboard-write"]);
  const before = page.url();
  await page.getByRole("button", { name: "Copy share link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(page.url()).toBe(before);
  expect(new URL(link).hash).toContain("plan=");
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(link);
  await expect(
    recipient.getByRole("button", { name: "Load shared estimate" }),
  ).toBeVisible();
  await recipient.getByRole("button", { name: "Keep current plan" }).click();
  await expect(
    recipient.getByLabel("Annual base salary"),
  ).toBeVisible();
  await recipient.goto(link);
  await recipient.getByRole("button", { name: "Load shared estimate" }).click();
  await expect(recipient.getByLabel("Annual base salary")).toHaveValue(
    "185000",
  );
  await expect(recipient.getByLabel("Number of options")).toHaveValue("1234");
  await context.close();
});

test("invalid and partial links preserve the saved plan until confirmed", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByLabel("Annual base salary").fill("185000");
  await page.goto("/?plan=invalid");
  await expect(page.getByLabel("Annual base salary")).toHaveValue("185000");
  await expect(
    page.getByText("This plan link is invalid.", { exact: false }),
  ).toBeVisible();
  await page.goto("/?share=1&salary=200000");
  await expect(page.getByLabel("Annual base salary")).toHaveValue("185000");
  await page.getByRole("button", { name: "Load shared estimate" }).click();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("200000");
});

test("an unreadable plan is kept until the user chooses a replacement", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.setItem("careerworth:v3", "{broken"));
  await page.reload();
  await expect(page.getByText("Saved inputs could not be restored.", { exact: false })).toBeVisible();
  await page.getByLabel("Annual base salary").fill("185000");
  expect(await page.evaluate(() => localStorage.getItem("careerworth:v3"))).toBe("{broken");

  await page.getByRole("button", { name: "Reset inputs" }).click();
  await page.getByRole("button", { name: "Reset plan" }).click();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("careerworth:v3"))).not.toBe("{broken");
});

test("a fresh plan ignores orphaned startup inputs and restores both input sets from backup", async ({
  page,
}) => {
  const orphaned = emptyStartupSession();
  orphaned.inputs[0].grant = "9999";
  await page.addInitScript((saved) => localStorage.setItem("careerworth:startup-v1", JSON.stringify(saved)), orphaned);
  await page.goto("/");
  await page.getByLabel("Annual base salary").fill("165000");
  await page.getByLabel("This is a startup offer").check();
  await expect(page.getByLabel("This is a startup offer")).toBeChecked();
  await expect(page.getByLabel("Annual base salary")).toHaveValue("165000");
  await expect(page.getByLabel("Number of options")).toHaveValue("");
  await page.getByLabel("Number of options").fill("1234");
  await page.getByRole("button", { name: "Add comparison" }).click();
  await page.getByLabel("This is a startup offer").check();
  await page.getByLabel("Number of options").fill("5678");
  const backup = page.locator(".planner-backup");
  const downloading = page.waitForEvent("download");
  await backup.getByRole("button", { name: "Download backup" }).click();
  const download = await downloading;
  await page.getByLabel("Number of options").fill("9999");
  await backup
    .locator('input[type="file"]')
    .setInputFiles((await download.path())!);
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Restore plan" })
    .click();
  await page.getByRole("button", { name: /Seattle offer/ }).click();
  await expect(page.getByLabel("Number of options")).toHaveValue("5678");
  await page.getByRole("button", { name: /Amazon L4/ }).click();
  await page.getByLabel("This is a startup offer").check();
  await expect(page.getByLabel("Number of options")).toHaveValue("1234");
});

test("example indicator and selected year remain usable", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("Example plan", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Example plan", { exact: true })).toBeVisible();
  await page.getByLabel("Annual base salary").fill("185000");
  await expect(page.getByText("Example plan", { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Add comparison" }).click();
  await page.getByLabel("Results for calendar year").click();
  await page.getByRole("option", { name: "2027" }).click();
  await page.setViewportSize({ width: 320, height: 800 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByLabel("Results for calendar year").click();
  await page.getByRole("option", { name: "2026" }).click();
  await expect(page.getByLabel("Results for calendar year")).toHaveText("2026");
});
