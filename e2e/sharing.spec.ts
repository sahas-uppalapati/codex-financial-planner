import { expect, test } from "@playwright/test";

test("sharing is explicit and an incoming link does not silently replace the saved plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Annual salary before tax").fill("185000");
  await page.getByLabel("Monthly living costs").fill("5000");
  await expect(page).not.toHaveURL(/salary=|expenses=/);
  await page.reload();
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("185000");
  await expect(page.getByLabel("Monthly living costs")).toHaveValue("5000");

  await page.getByText("Share a partial estimate").click();
  await page.getByRole("button", { name: "Create share link" }).click();
  const link = await page.getByLabel("Partial estimate link").inputValue();
  expect(link).toContain("salary=185000");
  await expect(page).not.toHaveURL(/salary=/);

  await page.getByLabel("Annual salary before tax").fill("99000");
  await page.goto(link);
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("99000");
  await page.getByRole("button", { name: "Load shared estimate" }).click();
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("185000");
  await expect(page.getByLabel("Monthly living costs")).toHaveValue("5000");
});

test("an invalid incoming estimate cannot replace a saved plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Annual salary before tax").fill("185000");
  await page.goto("/?share=1&salary=999999999999");
  await page.getByRole("button", { name: "Load shared estimate" }).click();
  await expect(page.getByRole("alert")).toContainText("invalid or out-of-range");
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("185000");
  await page.reload();
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("185000");
});

test("a legacy URL does not change saved detailed expense categories on reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Add more detail" }).click();
  await page.getByText("Expense breakdown", { exact: true }).click();
  await page.getByLabel("Food", { exact: false }).fill("671");
  await page.goto("/?expenses=9000&salary=200000&mode=detailed");
  await expect(page.getByRole("button", { name: "Load shared estimate" })).toBeVisible();
  await page.getByRole("button", { name: "Keep current plan" }).click();
  await page.getByText("Expense breakdown", { exact: true }).click();
  await expect(page.getByLabel("Food", { exact: false })).toHaveValue("671");
  await page.reload();
  await page.getByRole("button", { name: "Keep current plan" }).click();
  await page.getByText("Expense breakdown", { exact: true }).click();
  await expect(page.getByLabel("Food", { exact: false })).toHaveValue("671");
});
