export const categoryKeys = [
  "housing",
  "food",
  "transportation",
  "healthcare",
  "other",
] as const;
export type Category = (typeof categoryKeys)[number];
export type Categories = Record<Category, string>;
export interface Scenario {
  name: string;
  base: string;
  bonus: string;
  stock: string;
  growth: string;
  tax: string;
  expenses: Categories;
  includeStock: boolean;
  company: string;
  stage: string;
  compensationLocation: string;
  appliedCompensation: string | null;
  location: string;
  appliedLocation: string | null;
}
export interface Assumptions {
  starting: string;
  years: string;
  returns: string;
  inflation: string;
}
export interface PlannerState {
  version: 1;
  scenarios: [Scenario, Scenario];
  shared: Assumptions;
  comparison: boolean;
}
export interface ScenarioInput {
  base: number;
  bonus: number;
  stock: number;
  growth: number;
  tax: number;
  monthlyExpenses: number;
  includeStock: boolean;
}
export interface SharedInput {
  starting: number;
  years: number;
  returns: number;
  inflation: number;
}
export interface ProjectionRow {
  year: number;
  base: number;
  bonus: number;
  cashGross: number;
  stockGross: number;
  grossIncome: number;
  taxes: number;
  cashTaxes: number;
  stockTaxes: number;
  takeHome: number;
  expenses: number;
  surplus: number;
  stockContribution: number;
  openingBalance: number;
  investmentGain: number;
  endingBalance: number;
}
export const limits = {
  base: [0, 10_000_000],
  bonus: [0, 10_000_000],
  stock: [0, 10_000_000],
  growth: [-100, 20],
  tax: [0, 100],
  monthlyExpenses: [0, 1_000_000],
  starting: [0, 10_000_000],
  years: [1, 40],
  returns: [-100, 30],
  inflation: [0, 20],
} as const;
export type NumericField = keyof typeof limits;
export function fieldError(
  value: string,
  key: NumericField,
): string | undefined {
  if (!value.trim()) return "Enter a value; zero is allowed.";
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(value.trim()))
    return "Enter a valid number.";
  const n = Number(value),
    [min, max] = limits[key];
  if (key === "returns" && Number.isFinite(n) && n <= -100)
    return "Use a return greater than −100% and at most 30%.";
  if (!Number.isFinite(n) || n < min || n > max)
    return `Use ${min.toLocaleString("en-US")} to ${max.toLocaleString("en-US")}${["growth", "tax", "returns", "inflation"].includes(key) ? "%" : ""}.`;
  if (key === "years" && !Number.isInteger(n))
    return "Use a whole number of years.";
}
export function monthlyExpenses(s: Scenario): number {
  return categoryKeys.reduce((sum, k) => sum + Number(s.expenses[k]), 0);
}
export function scenarioErrors(s: Scenario): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!s.name.trim() || s.name.length > 100)
    errors.name = "Use a name with 1–100 characters.";
  for (const key of ["base", "bonus", "stock", "growth", "tax"] as const) {
    const error = fieldError(s[key], key);
    if (error) errors[key] = error;
  }
  for (const key of categoryKeys) {
    const error = fieldError(s.expenses[key], "monthlyExpenses");
    if (error) errors[key] = error;
  }
  if (
    categoryKeys.every((k) => !errors[k]) &&
    monthlyExpenses(s) > limits.monthlyExpenses[1]
  )
    errors.expenses = "Total monthly expenses must be at most $1,000,000.";
  return errors;
}
export function sharedErrors(shared: Assumptions): Record<string, string> {
  return Object.fromEntries(
    Object.entries(shared).flatMap(([key, value]) => {
      const error = fieldError(value, key as NumericField);
      return error ? [[key, error]] : [];
    }),
  );
}
export function isValidState(state: PlannerState): boolean {
  return (
    !Object.keys(sharedErrors(state.shared)).length &&
    state.scenarios
      .slice(0, state.comparison ? 2 : 1)
      .every((s) => !Object.keys(scenarioErrors(s)).length)
  );
}
export function toInput(s: Scenario): ScenarioInput {
  return {
    base: Number(s.base),
    bonus: Number(s.bonus),
    stock: Number(s.stock),
    growth: Number(s.growth),
    tax: Number(s.tax),
    monthlyExpenses: monthlyExpenses(s),
    includeStock: s.includeStock,
  };
}
export function toShared(s: Assumptions): SharedInput {
  return {
    starting: Number(s.starting),
    years: Number(s.years),
    returns: Number(s.returns),
    inflation: Number(s.inflation),
  };
}
export function project(s: ScenarioInput, a: SharedInput): ProjectionRow[] {
  const values = { ...s, ...a };
  for (const key of Object.keys(limits) as NumericField[]) {
    const val = values[key];
    if (!Number.isFinite(val) || val < limits[key][0] || val > limits[key][1])
      throw new RangeError(`Invalid ${key}`);
  }
  if (
    a.returns <= -100 ||
    !Number.isInteger(a.years) ||
    typeof s.includeStock !== "boolean"
  )
    throw new RangeError("Invalid projection inputs");
  let balance = a.starting;
  const rows: ProjectionRow[] = [];
  for (let year = 1; year <= a.years; year++) {
    const base = s.base * (1 + s.growth / 100) ** (year - 1);
    const cashGross = base + s.bonus;
    const stockGross = s.includeStock ? s.stock : 0;
    const cashTaxes = (cashGross * s.tax) / 100,
      stockTaxes = (stockGross * s.tax) / 100;
    const takeHome = cashGross - cashTaxes;
    const expenses =
      s.monthlyExpenses * 12 * (1 + a.inflation / 100) ** (year - 1);
    const surplus = takeHome - expenses;
    const stockContribution = stockGross - stockTaxes;
    const investmentGain = balance >= 0 ? (balance * a.returns) / 100 : 0;
    const endingBalance =
      balance + investmentGain + surplus + stockContribution;
    const row = {
      year,
      base,
      bonus: s.bonus,
      cashGross,
      stockGross,
      grossIncome: cashGross + stockGross,
      taxes: cashTaxes + stockTaxes,
      cashTaxes,
      stockTaxes,
      takeHome,
      expenses,
      surplus,
      stockContribution,
      openingBalance: balance,
      investmentGain,
      endingBalance,
    };
    if (!Object.values(row).every(Number.isFinite))
      throw new RangeError("Projection exceeded numerical limits");
    rows.push(row);
    balance = endingBalance;
  }
  return rows;
}
export function savingsRate(row: ProjectionRow): number | null {
  return row.takeHome === 0 ? null : row.surplus / row.takeHome;
}
export function defaultState(): PlannerState {
  const scenario = (
    name: string,
    base: string,
    tax: string,
    expenses: Categories,
  ): Scenario => ({
    name,
    base,
    bonus: "0",
    stock: "0",
    growth: "3",
    tax,
    expenses,
    includeStock: false,
    company: "Meta",
    stage: "entry",
    compensationLocation: "United States",
    appliedCompensation: null,
    location: "",
    appliedLocation: null,
  });
  return {
    version: 1,
    comparison: false,
    scenarios: [
      scenario("Columbus offer", "100000", "25", {
        housing: "1500",
        food: "450",
        transportation: "400",
        healthcare: "250",
        other: "400",
      }),
      scenario("Seattle offer", "140000", "28", {
        housing: "2600",
        food: "550",
        transportation: "450",
        healthcare: "300",
        other: "600",
      }),
    ],
    shared: { starting: "20000", years: "10", returns: "5", inflation: "2.5" },
  };
}
