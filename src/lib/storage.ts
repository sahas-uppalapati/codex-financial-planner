import {
  categoryKeys,
  defaultState,
  isValidState,
  scenarioErrors,
} from "./model";
import type { PlannerState, Scenario } from "./model";
import {
  companies,
  stages,
  compensationPresets,
  compensationRegions,
  locationPresets,
} from "../data/presets";
export const STORAGE_KEY = "careerworth:v1";
interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
function isScenario(value: unknown): value is Scenario {
  if (!value || typeof value !== "object") return false;
  const s = value as Scenario;
  return (
    [
      "name",
      "base",
      "bonus",
      "stock",
      "growth",
      "tax",
      "company",
      "stage",
      "location",
      "compensationLocation",
    ].every((k) => typeof s[k as keyof Scenario] === "string") &&
    typeof s.includeStock === "boolean" &&
    !!s.expenses &&
    categoryKeys.every((k) => typeof s.expenses[k] === "string") &&
    companies.includes(s.company as (typeof companies)[number]) &&
    stages.some((p) => p.id === s.stage) &&
    compensationRegions.includes(s.compensationLocation as (typeof compensationRegions)[number]) &&
    (s.location === "" || locationPresets.some((p) => p.id === s.location)) &&
    (s.appliedCompensation === null ||
      compensationPresets.some((p) => p.id === s.appliedCompensation)) &&
    (s.appliedLocation === null ||
      locationPresets.some((p) => p.id === s.appliedLocation)) &&
    !Object.keys(scenarioErrors(s)).length
  );
}
export function loadState(storage: StorageLike): {
  state: PlannerState;
  message: string;
} {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return { state: defaultState(), message: "" };
    const value = JSON.parse(raw);
    if (
      value?.version !== 1 ||
      typeof value.comparison !== "boolean" ||
      !Array.isArray(value.scenarios) ||
      value.scenarios.length !== 2 ||
      !value.scenarios.every(isScenario) ||
      !value.shared ||
      !["starting", "years", "returns", "inflation"].every(
        (k) => typeof value.shared[k] === "string",
      ) ||
      !isValidState(value)
    )
      throw new Error("Invalid saved inputs");
    // Copy only schema fields: saved data never becomes executable content.
    const state: PlannerState = {
      version: 1,
      comparison: value.comparison,
      scenarios: value.scenarios,
      shared: value.shared,
    };
    return { state, message: "" };
  } catch {
    return {
      state: defaultState(),
      message:
        "Saved inputs could not be restored. Showing the example instead.",
    };
  }
}
export function saveState(storage: StorageLike, state: PlannerState): boolean {
  try {
    if (
      !isValidState(state) ||
      state.scenarios.some((s) => Object.keys(scenarioErrors(s)).length)
    )
      return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}
