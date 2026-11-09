import type { PlannerV2, TaxLocation } from "./planner";
import { defaultPlanner } from "./planner";

export const VALID_LOCATIONS = new Set<TaxLocation>([
  "columbus",
  "seattle",
  "san-francisco",
  "new-york",
  "austin",
  "boston",
]);

/**
 * Parses search query parameters from a URL or window.location.search into planner overrides.
 */
export function parsePlannerUrlParams(search: string): {
  mode?: "quick" | "detailed";
  hasCustomParams: boolean;
  valid: boolean;
  applyTo: (base: PlannerV2) => PlannerV2;
} {
  const params = new URLSearchParams(search);
  let mode: "quick" | "detailed" | undefined;
  if (params.get("mode") === "detailed") mode = "detailed";
  else if (params.get("mode") === "quick") mode = "quick";

  const salary = params.get("salary") ?? params.get("base");
  const bonus = params.get("bonus");
  const stock = params.get("stock") ?? params.get("equity");
  const expenses = params.get("expenses") ?? params.get("living_costs");
  const growth = params.get("growth") ?? params.get("raise");
  const location = params.get("location") ?? params.get("city");
  const filing = params.get("filing");
  const spouseSalary = params.get("spouse_salary") ?? params.get("spouse_wages");
  const savings = params.get("savings") ?? params.get("invested");
  const years = params.get("years");
  const returns = params.get("returns");
  const inflation = params.get("inflation");
  const matchRate = params.get("match_rate");
  const matchPayPercent = params.get("match_percent");

  const hasParams = Boolean(
    params.get("share") === "1" ||
    salary !== null ||
    bonus !== null ||
    stock !== null ||
    expenses !== null ||
    growth !== null ||
    location !== null ||
    filing !== null ||
    spouseSalary !== null ||
    savings !== null ||
    years !== null ||
    returns !== null ||
    inflation !== null ||
    matchRate !== null ||
    matchPayPercent !== null
  );

  const applyTo = (planner: PlannerV2): PlannerV2 => {
    if (!hasParams) return planner;

    const s0 = { ...planner.scenarios[0] };
    const shared = { ...planner.shared };

    if (salary !== null && Number.isFinite(Number(salary))) {
      s0.base = salary;
    }
    if (bonus !== null && Number.isFinite(Number(bonus))) {
      s0.bonus = bonus;
    }
    if (stock !== null && Number.isFinite(Number(stock))) {
      s0.stock = stock;
      s0.includeStock = Number(stock) > 0;
    }
    if (growth !== null && Number.isFinite(Number(growth))) {
      s0.growth = growth;
    }
    if (expenses !== null && Number.isFinite(Number(expenses))) {
      const total = Number(expenses);
      s0.expenses = {
        housing: String(Math.round(total * 0.65)),
        food: String(Math.round(total * 0.15)),
        transportation: String(Math.round(total * 0.1)),
        healthcare: String(Math.round(total * 0.05)),
        other: String(Math.round(total * 0.05)),
      };
    }
    if (location && VALID_LOCATIONS.has(location as TaxLocation)) {
      s0.taxProfile = { ...s0.taxProfile, location: location as TaxLocation };
      s0.location = location;
    }
    if (filing === "single" || filing === "joint") {
      s0.taxProfile = { ...s0.taxProfile, filing };
    }
    if (spouseSalary !== null && Number.isFinite(Number(spouseSalary))) {
      s0.taxProfile = { ...s0.taxProfile, spouseWages: spouseSalary };
    }
    if (matchRate !== null && Number.isFinite(Number(matchRate))) {
      s0.employerMatch = {
        ...s0.employerMatch,
        type: Number(matchRate) > 0 ? "simple" : "none",
        rate: matchRate,
      };
    }
    if (matchPayPercent !== null && Number.isFinite(Number(matchPayPercent))) {
      s0.employerMatch = {
        ...s0.employerMatch,
        payPercent: matchPayPercent,
      };
    }

    if (savings !== null && Number.isFinite(Number(savings))) {
      shared.starting = savings;
    }
    if (years !== null && Number.isFinite(Number(years))) {
      shared.years = years;
    }
    if (returns !== null && Number.isFinite(Number(returns))) {
      shared.returns = returns;
    }
    if (inflation !== null && Number.isFinite(Number(inflation))) {
      shared.inflation = inflation;
    }

    return {
      ...planner,
      scenarios: [s0, planner.scenarios[1]],
      shared,
    };
  };

  const numbers = [salary, bonus, stock, expenses, growth, spouseSalary, savings, years, returns, inflation, matchRate, matchPayPercent];
  const valid = numbers.every((value) => value === null || (value.trim() !== "" && Number.isFinite(Number(value)))) &&
    (location === null || VALID_LOCATIONS.has(location as TaxLocation)) &&
    (filing === null || filing === "single" || filing === "joint") &&
    (params.get("mode") === null || mode !== undefined);
  return { mode, hasCustomParams: hasParams, valid, applyTo };
}

/**
 * Serializes the current scenario / planner state into clean search parameters for sharing.
 */
export function buildPlannerSearchString(
  planner: PlannerV2,
  quickMode: boolean
): string {
  const params = new URLSearchParams();
  const s0 = planner.scenarios[0];
  const defaults = defaultPlanner();
  const defaultS0 = defaults.scenarios[0];
  const defaultShared = defaults.shared;

  params.set("share", "1");
  params.set("mode", quickMode ? "quick" : "detailed");

  // Monthly expenses total
  const monthlyExpenses =
    Number(s0.expenses.housing) +
    Number(s0.expenses.food) +
    Number(s0.expenses.transportation) +
    Number(s0.expenses.healthcare) +
    Number(s0.expenses.other);

  const defaultMonthlyExpenses =
    Number(defaultS0.expenses.housing) +
    Number(defaultS0.expenses.food) +
    Number(defaultS0.expenses.transportation) +
    Number(defaultS0.expenses.healthcare) +
    Number(defaultS0.expenses.other);

  if (s0.base !== defaultS0.base) params.set("salary", s0.base);
  if (monthlyExpenses !== defaultMonthlyExpenses) {
    params.set("expenses", String(monthlyExpenses));
  }
  if (planner.shared.starting !== defaultShared.starting) {
    params.set("savings", planner.shared.starting);
  }
  if (s0.taxProfile.location !== defaultS0.taxProfile.location) {
    params.set("location", s0.taxProfile.location);
  }

  // Detailed mode additions or non-default values
  if (s0.bonus && s0.bonus !== "0") params.set("bonus", s0.bonus);
  if (s0.stock && s0.stock !== "0" && s0.includeStock) params.set("equity", s0.stock);
  if (s0.growth && s0.growth !== defaultS0.growth) params.set("growth", s0.growth);
  if (s0.taxProfile.filing !== defaultS0.taxProfile.filing) {
    params.set("filing", s0.taxProfile.filing);
  }
  if (s0.taxProfile.spouseWages && s0.taxProfile.spouseWages !== "0") {
    params.set("spouse_salary", s0.taxProfile.spouseWages);
  }
  if (s0.employerMatch?.type === "simple") {
    if (s0.employerMatch.rate) params.set("match_rate", s0.employerMatch.rate);
    if (s0.employerMatch.payPercent) params.set("match_percent", s0.employerMatch.payPercent);
  }
  if (planner.shared.years !== defaultShared.years) {
    params.set("years", planner.shared.years);
  }
  if (planner.shared.returns !== defaultShared.returns) {
    params.set("returns", planner.shared.returns);
  }
  if (planner.shared.inflation !== defaultShared.inflation) {
    params.set("inflation", planner.shared.inflation);
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}
