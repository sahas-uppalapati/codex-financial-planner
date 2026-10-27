import { loadState as loadLegacy, STORAGE_KEY as LEGACY_KEY } from "./storage";
import {
  defaultPlanner,
  plannerScenarioErrors,
  upgradeScenario,
  validPlanner,
} from "./planner";
import type { PlannerV2 } from "./planner";
import { projectScenario } from "./projection";
export const PLANNER_KEY = "careerworth:v2";
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export function loadPlanner(storage: StorageLike): {
  state: PlannerV2;
  message: string;
} {
  try {
    const saved = storage.getItem(PLANNER_KEY);
    if (saved) {
      const state = JSON.parse(saved) as PlannerV2;
      // Pre-match v2 saves are retained and receive the conservative zero-match default.
      if (Array.isArray(state?.scenarios)) {
        const defaults = defaultPlanner();
        state.shared = {
          ...defaults.shared,
          ...state.shared,
          startingSpouseRetirement: state.shared?.startingSpouseRetirement ?? "0",
          startingSpouseHsa: state.shared?.startingSpouseHsa ?? "0",
        };
        state.scenarios = state.scenarios.map((scenario, index) => ({
          ...scenario,
          employerMatch: scenario.employerMatch ?? defaults.scenarios[index].employerMatch,
        })) as PlannerV2["scenarios"];
      }
      if (
        state?.version !== 2 ||
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
      return { state, message: "" };
    }
    if (storage.getItem(LEGACY_KEY)) {
      const old = loadLegacy(storage);
      if (old.message) return { state: defaultPlanner(), message: old.message };
      const state: PlannerV2 = {
        version: 2,
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
