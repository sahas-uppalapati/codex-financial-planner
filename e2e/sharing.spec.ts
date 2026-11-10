import { expect, test } from "@playwright/test";

test("the address bar shares the current plan with a fresh browser", async ({ page, browser }) => {
  await page.goto("/");
  await page.getByLabel("Annual salary before tax").fill("185000");
  await page.getByLabel("Monthly living costs").fill("5000");
  await expect.poll(() => new URL(page.url()).searchParams.get("plan")).toContain("185000");
  const context = await browser.newContext();
  const recipient = await context.newPage();
  await recipient.goto(page.url());
  await expect(recipient.getByLabel("Annual salary before tax")).toHaveValue("185000");
  await expect(recipient.getByLabel("Monthly living costs")).toHaveValue("5000");
  await page.getByLabel("Annual salary before tax").fill("");
  await expect(page.getByRole("button", { name: "Copy plan link" })).toBeDisabled();
  await expect.poll(() => new URL(page.url()).searchParams.has("plan")).toBe(false);
  await context.close();
});

test("an invalid full link keeps the saved plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Annual salary before tax").fill("185000");
  await page.goto("/?plan=invalid");
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("185000");
  await expect(page.getByText("This plan link is invalid.", { exact: false })).toBeVisible();
});

test("legacy partial links still ask before replacing a saved plan", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Annual salary before tax").fill("185000");
  await page.goto("/?share=1&salary=200000");
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("185000");
  await page.getByRole("button", { name: "Load shared estimate" }).click();
  await expect(page.getByLabel("Annual salary before tax")).toHaveValue("200000");
});
