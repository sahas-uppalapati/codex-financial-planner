import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { ProjectionChart } from "./ProjectionChart";

it("includes the starting balance in first-year contributions and growth", () => {
  const html = renderToStaticMarkup(createElement(ProjectionChart, {
    starting: 80000,
    series: [{ name: "Plan", index: 0, rows: [{ endingBalance: 85000, surplus: 1000 }] }],
  }));
  expect(html).toContain("$81,000");
  expect(html).toContain("$4,000");
});
