import { parseStartupSession, type StartupSession } from "./startupComparison";
import type { PlannerV2 } from "./planner";
import { defaultPlanner, numberError, taxLocations, totalBudget } from "./planner";
import { fieldError } from "./model";
import { loadPlanner, PLANNER_KEY } from "./plannerStorage";

interface FullPlanFormat1 {
  format: 1;
  quickMode?: boolean;
  planner: Record<string, unknown>;
}

interface FullPlanFormat2 {
  format: 2;
  quickMode?: boolean;
  delta?: Record<string, unknown>;
}

type FullPlanPayload = FullPlanFormat1 | FullPlanFormat2;

function parseFullPlanPayload(data: unknown): FullPlanPayload | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const obj = data as Record<string, unknown>;
  if (obj.quickMode !== undefined && typeof obj.quickMode !== "boolean")
    return null;
  if (obj.format === 1) {
    if (
      !obj.planner ||
      typeof obj.planner !== "object" ||
      Array.isArray(obj.planner) ||
      ![2, 3].includes((obj.planner as Record<string, unknown>).version as number)
    )
      return null;
    return {
      format: 1,
      quickMode: obj.quickMode,
      planner: obj.planner as Record<string, unknown>,
    };
  }
  if (obj.format === 2) {
    if (
      obj.delta !== undefined &&
      (!obj.delta || typeof obj.delta !== "object" || Array.isArray(obj.delta))
    )
      return null;
    const delta = obj.delta as Record<string, unknown> | undefined;
    if (delta && (
      (delta.comparison !== undefined && typeof delta.comparison !== "boolean") ||
      (delta.shared !== undefined && (!delta.shared || typeof delta.shared !== "object" || Array.isArray(delta.shared))) ||
      (delta.scenarios !== undefined && (!Array.isArray(delta.scenarios) || delta.scenarios.length > 2 || delta.scenarios.some((scenario) => !scenario || typeof scenario !== "object" || Array.isArray(scenario))))
    )) return null;
    return { format: 2, quickMode: obj.quickMode, delta };
  }
  return null;
}

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
  const spouseSalary =
    params.get("spouse_salary") ?? params.get("spouse_wages");
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
      matchPayPercent !== null,
  );

  const taxLocation = taxLocations.find(({ id }) => id === location)?.id;
  const valid = (salary === null || !fieldError(salary, "base")) &&
    (bonus === null || !fieldError(bonus, "bonus")) &&
    (stock === null || !fieldError(stock, "stock")) &&
    (expenses === null || !fieldError(expenses, "monthlyExpenses")) &&
    (growth === null || !fieldError(growth, "growth")) &&
    (spouseSalary === null || !numberError(spouseSalary)) &&
    (savings === null || !fieldError(savings, "starting")) &&
    (years === null || !fieldError(years, "years")) &&
    (returns === null || !fieldError(returns, "returns")) &&
    (inflation === null || !fieldError(inflation, "inflation")) &&
    (matchRate === null || !numberError(matchRate, 0, 100)) &&
    (matchPayPercent === null || !numberError(matchPayPercent, 0, 100)) &&
    (location === null || taxLocation !== undefined) &&
    (filing === null || filing === "single" || filing === "joint") &&
    (params.get("mode") === null || mode !== undefined);

  const applyTo = (planner: PlannerV2): PlannerV2 => {
    if (!hasParams || !valid) return planner;

    const s0 = { ...planner.scenarios[0] };
    const shared = { ...planner.shared };

    if (salary !== null) {
      s0.base = salary;
    }
    if (bonus !== null) {
      s0.bonus = bonus;
    }
    if (stock !== null) {
      s0.stock = stock;
      s0.includeStock = Number(stock) > 0;
      s0.stockMode = "legacy";
    }
    if (growth !== null) {
      s0.growth = growth;
    }
    if (expenses !== null) {
      const cents = Math.round(Number(expenses) * 100);
      const housing = Math.floor(cents * 65 / 100);
      const food = Math.floor(cents * 15 / 100);
      const transportation = Math.floor(cents * 10 / 100);
      const healthcare = Math.floor(cents * 5 / 100);
      s0.expenses = {
        housing: String(housing / 100),
        food: String(food / 100),
        transportation: String(transportation / 100),
        healthcare: String(healthcare / 100),
        other: String((cents - housing - food - transportation - healthcare) / 100),
      };
    }
    if (taxLocation !== undefined) {
      s0.taxProfile = { ...s0.taxProfile, location: taxLocation };
      s0.location = taxLocation;
    }
    if (filing === "single" || filing === "joint") {
      s0.taxProfile = { ...s0.taxProfile, filing };
    }
    if (spouseSalary !== null) {
      s0.taxProfile = { ...s0.taxProfile, spouseWages: spouseSalary };
    }
    if (matchRate !== null) {
      s0.employerMatch = {
        ...s0.employerMatch,
        type: Number(matchRate) > 0 ? "simple" : "none",
        rate: matchRate,
      };
    }
    if (matchPayPercent !== null) {
      s0.employerMatch = {
        ...s0.employerMatch,
        payPercent: matchPayPercent,
      };
    }

    if (savings !== null) {
      shared.starting = savings;
    }
    if (years !== null) {
      shared.years = years;
    }
    if (returns !== null) {
      shared.returns = returns;
    }
    if (inflation !== null) {
      shared.inflation = inflation;
    }

    return {
      ...planner,
      scenarios: [s0, planner.scenarios[1]],
      shared,
    };
  };

  return { mode, hasCustomParams: hasParams, valid, applyTo };
}

/**
 * Serializes the current scenario / planner state into clean search parameters for sharing.
 */
export function buildPlannerSearchString(
  planner: PlannerV2,
  quickMode: boolean,
): string {
  const params = new URLSearchParams();
  const s0 = planner.scenarios[0];
  const defaults = defaultPlanner();
  const defaultS0 = defaults.scenarios[0];
  const defaultShared = defaults.shared;

  params.set("share", "1");
  params.set("mode", quickMode ? "quick" : "detailed");

  const monthlyExpenses = totalBudget(s0);
  const defaultMonthlyExpenses = totalBudget(defaultS0);

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
  if (s0.stock && s0.stock !== "0" && s0.includeStock)
    params.set("equity", s0.stock);
  if (s0.growth && s0.growth !== defaultS0.growth)
    params.set("growth", s0.growth);
  if (s0.taxProfile.filing !== defaultS0.taxProfile.filing) {
    params.set("filing", s0.taxProfile.filing);
  }
  if (s0.taxProfile.spouseWages && s0.taxProfile.spouseWages !== "0") {
    params.set("spouse_salary", s0.taxProfile.spouseWages);
  }
  if (s0.employerMatch?.type === "simple") {
    if (
      s0.employerMatch.rate &&
      s0.employerMatch.rate !== defaultS0.employerMatch.rate
    ) {
      params.set("match_rate", s0.employerMatch.rate);
    }
    if (
      s0.employerMatch.payPercent &&
      s0.employerMatch.payPercent !== defaultS0.employerMatch.payPercent
    ) {
      params.set("match_percent", s0.employerMatch.payPercent);
    }
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

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === "object" && !Array.isArray(v);
}

/**
 * Computes a minimal delta between the current state and default planner inputs.
 * When comparison is disabled, untouched second scenario inputs are omitted completely.
 */
export function diffPlannerState(
  target: PlannerV2,
): Record<string, unknown> | undefined {
  const defaults = defaultPlanner();

  function diffValues(base: unknown, curr: unknown): unknown {
    if (base === curr) return undefined;
    if (!isPlainObject(base) || !isPlainObject(curr)) {
      if (Array.isArray(base) && Array.isArray(curr)) {
        if (JSON.stringify(base) === JSON.stringify(curr)) return undefined;
        return curr;
      }
      return curr;
    }
    const diff: Record<string, unknown> = {};
    let hasDiff = false;
    for (const key of Object.keys(curr)) {
      const d = diffValues(base[key], curr[key]);
      if (d !== undefined) {
        diff[key] = d;
        hasDiff = true;
      }
    }
    return hasDiff ? diff : undefined;
  }

  const result: Record<string, unknown> = {};
  let changed = false;

  if (target.comparison !== defaults.comparison) {
    result.comparison = target.comparison;
    changed = true;
  }

  const sharedDiff = diffValues(defaults.shared, target.shared) as
    | Record<string, unknown>
    | undefined;
  if (sharedDiff) {
    result.shared = sharedDiff;
    changed = true;
  }

  const s0Diff = diffValues(defaults.scenarios[0], target.scenarios[0]) as
    | Record<string, unknown>
    | undefined;
  const s1Diff =
    target.comparison ||
    JSON.stringify(defaults.scenarios[1]) !==
      JSON.stringify(target.scenarios[1])
      ? (diffValues(defaults.scenarios[1], target.scenarios[1]) as
          | Record<string, unknown>
          | undefined)
      : undefined;

  if (s0Diff || s1Diff) {
    result.scenarios = s1Diff ? [s0Diff ?? {}, s1Diff] : [s0Diff ?? {}];
    changed = true;
  }

  return changed ? result : undefined;
}

/** Reconstructs a full PlannerV2 state by applying a sparse delta over default inputs. */
export function applyPlannerDelta(delta: unknown): PlannerV2 {
  const result = defaultPlanner();
  if (!isPlainObject(delta)) return result;

  function merge(
    target: Record<string, unknown>,
    source: Record<string, unknown>,
  ) {
    for (const key of Object.keys(source)) {
      if (
        !Object.hasOwn(target, key) ||
        ["__proto__", "prototype", "constructor"].includes(key)
      )
        continue;
      const sVal = source[key];
      const tVal = target[key];
      if (isPlainObject(sVal) && isPlainObject(tVal)) {
        merge(tVal, sVal);
      } else {
        target[key] = sVal;
      }
    }
  }

  if (typeof delta.comparison === "boolean") {
    result.comparison = delta.comparison;
  }
  if (isPlainObject(delta.shared)) {
    merge(result.shared as unknown as Record<string, unknown>, delta.shared);
  }
  if (Array.isArray(delta.scenarios)) {
    if (isPlainObject(delta.scenarios[0])) {
      merge(
        result.scenarios[0] as unknown as Record<string, unknown>,
        delta.scenarios[0],
      );
    }
    if (isPlainObject(delta.scenarios[1])) {
      merge(
        result.scenarios[1] as unknown as Record<string, unknown>,
        delta.scenarios[1],
      );
    }
  }
  return result;
}

/** Full links retain all planner inputs and the selected view. */
export function readFullPlannerLink(
  search: string,
): { state: PlannerV2; quickMode: boolean } | null {
  const params = new URLSearchParams(search);
  const raw = params.get("plan");
  if (raw === null) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    const data = parseFullPlanPayload(parsed);
    if (!data) throw new Error();

    const stateToLoad: PlannerV2 =
      data.format === 1
        ? (data.planner as unknown as PlannerV2)
        : applyPlannerDelta(data.delta);

    const result = loadPlanner({
      getItem: (key) =>
        key === PLANNER_KEY ? JSON.stringify(stateToLoad) : null,
      setItem: () => {},
    });
    if (result.restoreFailed) throw new Error();
    return { state: result.state, quickMode: data.quickMode ?? false };
  } catch {
    throw new Error("This plan link is invalid. Your saved plan was kept.");
  }
}

export function fullPlannerUrl(
  url: string,
  state: PlannerV2 | null,
  quickMode = false,
): string {
  const next = new URL(url);
  next.search = "";
  if (state) {
    const delta = diffPlannerState(state);
    const payload = delta ? { format: 2, delta } : { format: 2 };
    if (quickMode) {
      (payload as Record<string, unknown>).quickMode = true;
    }
    next.searchParams.set("plan", JSON.stringify(payload));
  }
  return next.toString();
}

/** Fragment links contain the complete session and never alter the current address. */
export function sessionShareUrl(
  url: string,
  state: PlannerV2,
  startup: StartupSession,
): string {
  const next = new URL(url);
  next.search = "";
  next.hash = new URLSearchParams({
    plan: JSON.stringify({
      format: 3,
      planner: state,
      startup: parseStartupSession(startup),
    }),
  }).toString();
  return next.toString();
}
export function readSessionLink(
  hash: string,
): { state: PlannerV2; startup: StartupSession } | null {
  const raw = new URLSearchParams(hash.replace(/^#/, "")).get("plan");
  if (raw === null) return null;
  try {
    const data = JSON.parse(raw);
    if (
      !data ||
      data.format !== 3 ||
      !data.planner ||
      typeof data.planner !== "object" ||
      Array.isArray(data.planner) ||
      data.planner.version !== 3 ||
      !data.startup
    )
      throw new Error();
    const result = loadPlanner({
      getItem: (key) =>
        key === PLANNER_KEY ? JSON.stringify(data.planner) : null,
      setItem: () => {},
    });
    if (result.restoreFailed) throw new Error();
    return { state: result.state, startup: parseStartupSession(data.startup) };
  } catch {
    throw new Error("This plan link is invalid. Your saved plan was kept.");
  }
}
export function clearFinancialUrl(url: string): string {
  const next = new URL(url);
  for (const key of [
    "plan",
    "share",
    "mode",
    "salary",
    "base",
    "bonus",
    "stock",
    "equity",
    "expenses",
    "living_costs",
    "growth",
    "raise",
    "location",
    "city",
    "filing",
    "spouse_salary",
    "spouse_wages",
    "savings",
    "invested",
    "years",
    "returns",
    "inflation",
    "match_rate",
    "match_percent",
  ])
    next.searchParams.delete(key);
  if (new URLSearchParams(next.hash.slice(1)).has("plan")) next.hash = "";
  return next.toString();
}
