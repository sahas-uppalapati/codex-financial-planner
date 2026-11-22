import { describe, expect, it } from "vitest";
import { defaultPlanner } from "./planner";
import {
  exportPlannerBackup,
  importPlannerBackup,
  MAX_BACKUP_BYTES,
} from "./plannerBackup";

describe("portable planner backup", () => {
  it("round trips both scenarios and detailed financial inputs", () => {
    const plan = defaultPlanner();
    plan.comparison = true;
    plan.scenarios[0].expenses.housing = "2456";
    plan.scenarios[1].taxProfile.spouseWages = "85000";
    plan.shared.startingAccounts.push({
      id: "ira",
      owner: "primary",
      type: "roth-ira",
      balance: "12000",
    });
    const startup = {
      scenario: 1,
      inputs: [
        {
          ownership: "",
          grant: "",
          strike: "",
          currentPrice: "",
          currentPriceType: "unknown" as const,
          dilution: "",
          vesting: "",
          vestMonths: "",
          cliffMonths: "",
          exitMode: "share" as const,
          exit: "",
        },
        {
          ownership: "",
          grant: "500",
          strike: "",
          currentPrice: "",
          currentPriceType: "unknown" as const,
          dilution: "",
          vesting: "",
          vestMonths: "",
          cliffMonths: "",
          exitMode: "share" as const,
          exit: "",
        },
      ] as [
        import("./startupComparison").StartupInputs,
        import("./startupComparison").StartupInputs,
      ],
    };
    expect(importPlannerBackup(exportPlannerBackup(plan, startup))).toEqual({
      planner: plan,
      startup,
    });
  });

  it("rejects malformed, unknown and invalid backups without accepting fallback defaults", () => {
    const plan = defaultPlanner();
    const wrapper = JSON.parse(exportPlannerBackup(plan));
    expect(() => importPlannerBackup("{bad")).toThrow();
    expect(() =>
      importPlannerBackup(JSON.stringify({ ...wrapper, version: 99 })),
    ).toThrow();
    expect(() =>
      importPlannerBackup(
        JSON.stringify({
          ...wrapper,
          startup: { scenario: 0, inputs: [{}, {}] },
        }),
      ),
    ).toThrow();
    expect(() =>
      importPlannerBackup(
        JSON.stringify({ ...wrapper, planner: { ...plan, version: 99 } }),
      ),
    ).toThrow();
    plan.scenarios[0].base = "-1";
    expect(() =>
      importPlannerBackup(JSON.stringify({ ...wrapper, planner: plan })),
    ).toThrow();
    expect(() => exportPlannerBackup(plan)).toThrow();
    expect(() => importPlannerBackup("é".repeat(MAX_BACKUP_BYTES / 2 + 1))).toThrow(
      "too large",
    );
  });

  it("migrates a prior planner version inside a recognized backup", () => {
    const plan = defaultPlanner();
    plan.version = 2 as 3;
    delete (plan.shared as Partial<typeof plan.shared>).startingAccounts;
    plan.shared.startingRetirement = "15000";
    const restored = importPlannerBackup(
      JSON.stringify({ format: "careerworth-plan", version: 1, planner: plan }),
    );
    expect(restored.startup.scenario).toBeNull();
    expect(restored.startup.inputs[0].grant).toBe("");
    expect(restored.planner.version).toBe(3);
    expect(restored.planner.shared.startingAccounts).toContainEqual(
      expect.objectContaining({ type: "traditional-401k", balance: "15000" }),
    );
  });
});
