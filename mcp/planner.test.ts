import { describe, expect, it } from "vitest";
import { examplePlan, projectPlan } from "./planner";
import { projectScenario } from "../src/lib/projection";

describe("local MCP planner", () => {
  it("reuses the validated engine and returns input, sources, and limitations", () => {
    const backup = examplePlan();
    const result = projectPlan(backup);
    expect(result.scenarios[0].startingTotal).toBe(projectScenario(result.input.scenarios[0], result.input.shared).startingTotal);
    expect(result.scenarios[0].rows).toEqual(projectScenario(result.input.scenarios[0], result.input.shared).rows);
    expect(result.provenance.taxRules).toBe("US-W2-2026.1");
    expect(result.limitations.length).toBeGreaterThan(0);
  });
  it("rejects malformed or out-of-range backups", () => {
    expect(() => projectPlan("{}")).toThrow();
    const data = JSON.parse(examplePlan());
    data.planner.scenarios[0].base = "999999999999";
    expect(() => projectPlan(JSON.stringify(data))).toThrow();
  });
});
