import { loadState as loadLegacy, STORAGE_KEY as LEGACY_KEY } from "./storage";
import {
  defaultPlanner,
  plannerScenarioErrors,
  upgradeScenario,
  validPlanner,
} from "./planner";
import type { PlannerV2 } from "./planner";
import { projectScenario } from "./projection";
export const PLANNER_KEY = "careerworth:v3";
const PRIOR_PLANNER_KEY = "careerworth:v2";
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadPlanner(storage: StorageLike): {
  state: PlannerV2;
  message: string;
} {
  try {
    const saved = storage.getItem(PLANNER_KEY) ?? storage.getItem(PRIOR_PLANNER_KEY);
    if (saved) {
      const state = JSON.parse(saved) as PlannerV2;
      let migrationMessage = "";
      // Pre-match v2 saves are retained and receive the conservative zero-match default.
      if (Array.isArray(state?.scenarios)) {
        const defaults = defaultPlanner();
        const oldRetirementBalances = [
          { id: "migrated-primary-401k", owner: "primary" as const, type: "traditional-401k" as const, balance: state.shared?.startingRetirement ?? "0" },
          { id: "migrated-spouse-401k", owner: "spouse" as const, type: "traditional-401k" as const, balance: state.shared?.startingSpouseRetirement ?? "0" },
          { id: "migrated-primary-hsa", owner: "primary" as const, type: "hsa" as const, balance: state.shared?.startingHsa ?? "0" },
          { id: "migrated-spouse-hsa", owner: "spouse" as const, type: "hsa" as const, balance: state.shared?.startingSpouseHsa ?? "0" },
        ].filter((account) => Number(account.balance) > 0);
        const legacyStartingBalances = !Array.isArray(state.shared?.startingAccounts);
        const legacyContributionTargets = state.scenarios.some((scenario) => !scenario.retirementTargets);
        const canMigrateStartingBalances = legacyStartingBalances && [
          state.shared?.startingRetirement ?? "0",
          state.shared?.startingSpouseRetirement ?? "0",
          state.shared?.startingHsa ?? "0",
          state.shared?.startingSpouseHsa ?? "0",
        ].every((value) => typeof value === "string" && Number.isFinite(Number(value)) && Number(value) >= 0);
        if (canMigrateStartingBalances && oldRetirementBalances.length)
          migrationMessage = "Saved inputs upgraded. Existing retirement and HSA balances were assigned to the primary owner. Review Starting balances to reassign them if needed.";
        else if (legacyContributionTargets)
          migrationMessage = "Saved inputs upgraded. Existing 401(k) annual-dollar targets were retained in dollar mode; new Roth and IRA targets start at zero.";
        const accounts = !canMigrateStartingBalances
          ? state.shared.startingAccounts
          : oldRetirementBalances;
        state.shared = {
          ...defaults.shared,
          ...state.shared,
          startingAccounts: accounts,
          startingRetirement: canMigrateStartingBalances ? "0" : state.shared?.startingRetirement ?? "0",
          startingSpouseRetirement: canMigrateStartingBalances ? "0" : state.shared?.startingSpouseRetirement ?? "0",
          startingHsa: canMigrateStartingBalances ? "0" : state.shared?.startingHsa ?? "0",
          startingSpouseHsa: canMigrateStartingBalances ? "0" : state.shared?.startingSpouseHsa ?? "0",
        };
        state.scenarios = state.scenarios.map((scenario, index) => ({
          ...scenario,
          employerMatch: scenario.employerMatch ?? defaults.scenarios[index].employerMatch,
          retirementProfiles: scenario.retirementProfiles ?? defaults.scenarios[index].retirementProfiles,
          retirementTargets: scenario.retirementTargets ? {
            primary: { ...defaults.scenarios[index].retirementTargets.primary, ...scenario.retirementTargets.primary },
            spouse: { ...defaults.scenarios[index].retirementTargets.spouse, ...scenario.retirementTargets.spouse },
          } : {
            primary: {
              ...defaults.scenarios[index].retirementTargets.primary,
              workplace401k: {
                ...defaults.scenarios[index].retirementTargets.primary.workplace401k,
                mode: "dollars" as const,
                amount: scenario.benefits.retirement,
              },
            },
            spouse: {
              ...defaults.scenarios[index].retirementTargets.spouse,
              workplace401k: {
                ...defaults.scenarios[index].retirementTargets.spouse.workplace401k,
                mode: "dollars" as const,
                amount: scenario.spouseBenefits.retirement,
              },
            },
          },
          benefits: scenario.retirementTargets ? scenario.benefits : { ...scenario.benefits, retirement: "0" },
          spouseBenefits: scenario.retirementTargets ? scenario.spouseBenefits : { ...scenario.spouseBenefits, retirement: "0" },
        })) as PlannerV2["scenarios"];
        state.version = 3;
      }
      if (
        state?.version !== 3 ||
        typeof state.comparison !== "boolean" ||
        !Array.isArray(state.scenarios) ||
        state.scenarios.length !== 2 ||
        !validPlanner(state) ||
        state.scenarios.some(
          (s) => Object.keys(plannerScenarioErrors(s, state.shared)).length,
        )
      )
        throw new Error("Malformed planner");
      state.scenarios.forEach((s) => projectScenario(s, state.shared));
      return { state, message: migrationMessage };
    }
    if (storage.getItem(LEGACY_KEY)) {
      const old = loadLegacy(storage);
      if (old.message) return { state: defaultPlanner(), message: old.message };
      const state: PlannerV2 = {
        version: 3,
        comparison: old.state.comparison,
        scenarios: old.state.scenarios.map((s, i) =>
          upgradeScenario(s, i, true),
        ) as PlannerV2["scenarios"],
        shared: {
          ...old.state.shared,
          startYear: "2026",
          taxInflation: "2.5",
          startingRetirement: "0",
          startingHsa: "0",
          startingSpouseRetirement: "0",
          startingSpouseHsa: "0",
          startingAccounts: [],
        },
      };
      return {
        state,
        message:
          "Saved inputs upgraded. Manual tax rates and legacy annual stock were retained; monthly investment timing changes projected balances. The original v1 save is preserved.",
      };
    }
    return { state: defaultPlanner(), message: "" };
  } catch {
    return {
      state: defaultPlanner(),
      message:
        "Saved inputs could not be restored. Showing the example instead.",
    };
  }
}
export function savePlanner(storage: StorageLike, state: PlannerV2): boolean {
  try {
    if (
      !validPlanner(state) ||
      state.scenarios.some(
        (s) => Object.keys(plannerScenarioErrors(s, state.shared)).length,
      )
    )
      return false;
    storage.setItem(PLANNER_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
