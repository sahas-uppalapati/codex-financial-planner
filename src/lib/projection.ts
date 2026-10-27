import type { ProjectionRow } from "./model";
import type { AssumptionsV2, Benefits, ScenarioV2 } from "./planner";
import {
  monthIndex,
  monthLabel,
  plannerScenarioErrors,
  plannerSharedErrors,
  totalBudget,
} from "./planner";
import { buildEquity, issuerPrice } from "./equity";
import type { EquityPlan, EquityVest } from "./equity";
import { calculateTaxes } from "./tax";
import type { TaxBreakdown, WorkerTaxInput } from "./tax";
export interface AccountBalances {
  taxable: number;
  employerStock: number;
  retirement: number;
  hsa: number;
}
export interface MonthlyRow {
  month: number;
  date: string;
  role: string;
  employer: string;
  base: number;
  bonus: number;
  spouseCash: number;
  cashGross: number;
  stockGross: number;
  taxes: number;
  cashTaxes: number;
  stockTaxes: number;
  takeHome: number;
  budgetExpenses: number;
  healthPremiums: number;
  healthcareOffset: number;
  expenses: number;
  surplus: number;
  retirementContribution: number;
  hsaContribution: number;
  stockContribution: number;
  heldContribution: number;
  forfeitedEquity: number;
  investmentGain: number;
  unrealizedGain: number;
  balances: AccountBalances;
  endingBalance: number;
  vests: EquityVest[];
  event: string;
}
export interface AnnualRow extends ProjectionRow {
  calendarYear: number;
  role: string;
  spouseCash: number;
  benefits: number;
  healthPremiums: number;
  healthcareOffset: number;
  budgetExpenses: number;
  heldContribution: number;
  retirementContribution: number;
  hsaContribution: number;
  forfeitedEquity: number;
  unrealizedGain: number;
  balances: AccountBalances;
  taxBreakdown: TaxBreakdown;
  months: MonthlyRow[];
}
export interface Projection {
  rows: AnnualRow[];
  months: MonthlyRow[];
  equity: EquityPlan;
  starting: AccountBalances;
  startingTotal: number;
  warnings: string[];
}
interface CashMonth {
  base: number;
  bonus: number;
  spouseCash: number;
  cashGross: number;
  role: string;
  employer: string;
  event: string;
  primary: WorkerTaxInput;
  spouse: WorkerTaxInput;
  health: number;
  retirement: number;
  hsa: number;
}
const sum = (items: number[]) => items.reduce((a, b) => a + b, 0);
const accountTotal = (a: AccountBalances) =>
  a.taxable + a.employerStock + a.retirement + a.hsa;
function allocateBenefits(
  cash: number,
  b: Benefits,
  used: { retirement: number; hsa: number },
  retirementCap: number,
  hsaCap: number,
): WorkerTaxInput {
  let remaining = cash;
  const health = Math.min(Number(b.health) / 12, remaining);
  remaining -= health;
  const hsa = Math.min(
    Number(b.hsa) / 12,
    remaining,
    Math.max(0, hsaCap - used.hsa),
  );
  remaining -= hsa;
  used.hsa += hsa;
  const retirement = Math.min(
    Number(b.retirement) / 12,
    remaining,
    Math.max(0, retirementCap - used.retirement),
  );
  used.retirement += retirement;
  return { cash, stock: 0, health, hsa, retirement };
}
function combineWorkers(
  months: CashMonth[],
  who: "primary" | "spouse",
  stock = 0,
): WorkerTaxInput {
  return {
    cash: sum(months.map((m) => m[who].cash)),
    stock,
    health: sum(months.map((m) => m[who].health)),
    retirement: sum(months.map((m) => m[who].retirement)),
    hsa: sum(months.map((m) => m[who].hsa)),
  };
}
export function projectScenario(s: ScenarioV2, a: AssumptionsV2): Projection {
  const errors = { ...plannerSharedErrors(a), ...plannerScenarioErrors(s, a) };
  if (Object.keys(errors).length)
    throw new RangeError(Object.values(errors)[0]);
  const startYear = Number(a.startYear),
    years = Number(a.years);
  const equity =
    s.stockMode === "grants"
      ? buildEquity(s, a)
      : { grants: [], vests: [], forfeitures: [], employment: [] };
  const events = [...s.events].sort((x, y) => x.month.localeCompare(y.month));
  const monthlyReturn = Math.expm1(Math.log1p(Number(a.returns) / 100) / 12);
  const starting: AccountBalances = {
    taxable: Number(a.starting),
    employerStock: sum(
      s.issuers.map((i) => Number(i.startingShares) * Number(i.price)),
    ),
    retirement: Number(a.startingRetirement),
    hsa: Number(a.startingHsa),
  };
  const balances: AccountBalances = { ...starting };
  const held = new Map(
    s.issuers.map((i) => [
      i.id,
      { shares: Number(i.startingShares), basis: Number(i.startingBasis) },
    ]),
  );
  const rows: AnnualRow[] = [],
    allMonths: MonthlyRow[] = [],
    warnings = new Set<string>();
  if (s.stockMode === "legacy" && Number(s.stock) > 0)
    warnings.add(
      "Legacy annual stock repeats each December; it is not a grant. Convert explicitly to model vesting.",
    );
  if (
    s.taxProfile.location === "san-francisco" &&
    s.taxProfile.mode === "calculated"
  )
    warnings.add(
      "California personal-credit phaseout starts are derived from announced 2026 indexing pending the complete published booklet.",
    );
  let role = s.role,
    issuerId = s.employerId,
    annualBase = Number(s.base),
    annualBonus = Number(s.bonus),
    growth = Number(s.growth),
    roleStart = 0;
  for (let year = 0; year < years; year++) {
    const calendarYear = startYear + year,
      scale = (1 + Number(a.taxInflation) / 100) ** (calendarYear - 2026);
    const retirementCap = 24500 * scale,
      hsaCap =
        (s.taxProfile.hsaCoverage === "none"
          ? 0
          : s.taxProfile.hsaCoverage === "self"
            ? 4400 * (s.taxProfile.filing === "joint" ? 2 : 1)
            : 8750) * scale;
    const usedPrimary = { retirement: 0, hsa: 0 },
      usedSpouse = { retirement: 0, hsa: 0 };
    const cashMonths: CashMonth[] = [];
    let accruedBonus = 0;
    for (let within = 0; within < 12; within++) {
      const month = year * 12 + within,
        e = events.find((e) => monthIndex(e.month, startYear) === month);
      if (e) {
        role = e.role;
        issuerId = e.issuerId;
        annualBase = Number(e.base);
        annualBonus = Number(e.bonus);
        growth = Number(e.growth);
        roleStart = month;
      }
      const base =
        (annualBase *
          (1 + growth / 100) ** Math.floor((month - roleStart) / 12)) /
        12;
      accruedBonus += annualBonus / 12;
      const bonus = within === 11 ? accruedBonus : 0;
      const spouseCash =
        s.taxProfile.filing === "joint"
          ? (Number(s.taxProfile.spouseWages) *
              (1 + Number(s.taxProfile.spouseGrowth) / 100) ** year) /
            12
          : 0;
      const primary = allocateBenefits(
        base + bonus,
        s.benefits,
        usedPrimary,
        retirementCap,
        s.taxProfile.hsaCoverage === "self"
          ? 4400 * scale
          : Math.max(0, hsaCap - usedSpouse.hsa),
      );
      const spouse = allocateBenefits(
        spouseCash,
        s.taxProfile.filing === "joint"
          ? s.spouseBenefits
          : { retirement: "0", hsa: "0", health: "0" },
        usedSpouse,
        retirementCap,
        s.taxProfile.hsaCoverage === "self"
          ? 4400 * scale
          : Math.max(0, hsaCap - usedPrimary.hsa),
      );
      cashMonths.push({
        base,
        bonus,
        spouseCash,
        cashGross: base + bonus + spouseCash,
        role,
        employer: s.issuers.find((i) => i.id === issuerId)!.name,
        event: e
          ? `${e.kind === "job" ? "Change employer" : "Promotion"}: ${e.role}`
          : "",
        primary,
        spouse,
        health: primary.health + spouse.health,
        retirement: primary.retirement + spouse.retirement,
        hsa: primary.hsa + spouse.hsa,
      });
    }
    const vestMonths = Array.from({ length: 12 }, (_, within) =>
      equity.vests.filter((v) => v.month === year * 12 + within),
    );
    const legacyStock =
      s.stockMode === "legacy" && s.includeStock ? Number(s.stock) : 0;
    if (legacyStock > 0)
      vestMonths[11].push({
        grantId: "legacy",
        grantName: "Legacy annual stock",
        issuerId: s.employerId,
        month: year * 12 + 11,
        shares: 0,
        price: 1,
        value: legacyStock,
        treatment: "sell",
      });
    const annualStock = sum(vestMonths.flat().map((v) => v.value));
    const primary = combineWorkers(cashMonths, "primary"),
      spouse = combineWorkers(cashMonths, "spouse");
    const cashTax = calculateTaxes(
      [primary, spouse],
      s.taxProfile,
      calendarYear,
      Number(a.taxInflation),
      s.taxProfile.mode === "manual" ? Number(s.tax) : 0,
    );
    const fullTax = calculateTaxes(
      [{ ...primary, stock: annualStock }, spouse],
      s.taxProfile,
      calendarYear,
      Number(a.taxInflation),
      s.taxProfile.mode === "manual" ? Number(s.tax) : 0,
    );
    const incrementalTax = fullTax.total - cashTax.total,
      annualCash = sum(cashMonths.map((m) => m.cashGross));
    const yearOpening = accountTotal(balances),
      months: MonthlyRow[] = [];
    for (let within = 0; within < 12; within++) {
      const month = year * 12 + within,
        c = cashMonths[within],
        vests = vestMonths[within];
      const stockGross = sum(vests.map((v) => v.value));
      // Allocate reconciled annual liabilities, not supplemental withholding rates.
      const cashTaxes =
        annualCash > 0
          ? (cashTax.total * c.cashGross) / annualCash
          : cashTax.total / 12;
      const stockTaxes =
        annualStock > 0 ? (incrementalTax * stockGross) / annualStock : 0;
      const takeHome =
        c.cashGross - c.health - c.retirement - c.hsa - cashTaxes;
      const inflation = (1 + Number(a.inflation) / 100) ** year;
      const budgetExpenses = totalBudget(s) * inflation;
      const healthcareOffset = Math.min(
        Number(s.expenses.healthcare) * inflation,
        c.health,
      );
      const expenses = budgetExpenses - healthcareOffset,
        surplus = takeHome - expenses;
      if (c.health > Number(s.expenses.healthcare) * inflation + 0.01)
        warnings.add(
          "Payroll health premiums exceed the healthcare budget; all premiums are still deducted and the post-payroll healthcare expense is floored at zero.",
        );
      let stockContribution = 0,
        heldContribution = 0;
      for (const v of vests) {
        const tax =
          annualStock > 0 ? (incrementalTax * v.value) / annualStock : 0;
        if (v.treatment === "sell") stockContribution += v.value - tax;
        else {
          const cover = Math.max(0, Math.min(v.value, tax));
          const netValue = v.value - cover,
            netShares = v.price > 0 ? netValue / v.price : 0;
          const holding = held.get(v.issuerId)!;
          holding.shares += netShares;
          holding.basis += netValue;
          heldContribution += netValue;
          // Any tax exceeding the vest, or tax credit, is settled through cash reserves.
          stockContribution -= tax - cover;
        }
      }
      const investmentGain =
        Math.max(0, balances.taxable) * monthlyReturn +
        balances.retirement * monthlyReturn +
        balances.hsa * monthlyReturn;
      balances.taxable +=
        Math.max(0, balances.taxable) * monthlyReturn +
        surplus +
        stockContribution;
      balances.retirement =
        balances.retirement * (1 + monthlyReturn) + c.retirement;
      balances.hsa = balances.hsa * (1 + monthlyReturn) + c.hsa;
      balances.employerStock = sum(
        s.issuers.map(
          (i) => held.get(i.id)!.shares * issuerPrice(i, month + 1),
        ),
      );
      const unrealizedGain =
        balances.employerStock - sum([...held.values()].map((h) => h.basis));
      const forfeitedEquity = sum(
        equity.forfeitures.filter((f) => f.month === month).map((f) => f.value),
      );
      const r: MonthlyRow = {
        month,
        date: monthLabel(month, startYear),
        role: c.role,
        employer: c.employer,
        base: c.base,
        bonus: c.bonus,
        spouseCash: c.spouseCash,
        cashGross: c.cashGross,
        stockGross,
        taxes: cashTaxes + stockTaxes,
        cashTaxes,
        stockTaxes,
        takeHome,
        budgetExpenses,
        healthPremiums: c.health,
        healthcareOffset,
        expenses,
        surplus,
        retirementContribution: c.retirement,
        hsaContribution: c.hsa,
        stockContribution,
        heldContribution,
        forfeitedEquity,
        investmentGain,
        unrealizedGain,
        balances: { ...balances },
        endingBalance: accountTotal(balances),
        vests,
        event: c.event,
      };
      if (
        Object.values(r).some(
          (v) => typeof v === "number" && !Number.isFinite(v),
        ) ||
        !Object.values(balances).every(Number.isFinite)
      )
        throw new RangeError(
          "Projection exceeded numerical limits. Reduce amounts or growth assumptions.",
        );
      months.push(r);
      allMonths.push(r);
    }
    const last = months[11],
      sumField = (key: keyof MonthlyRow) =>
        sum(months.map((m) => Number(m[key])));
    rows.push({
      year: year + 1,
      calendarYear,
      role: last.role,
      base: sumField("base"),
      bonus: sumField("bonus"),
      spouseCash: sumField("spouseCash"),
      cashGross: annualCash,
      stockGross: annualStock,
      grossIncome: annualCash + annualStock,
      taxes: fullTax.total,
      cashTaxes: cashTax.total,
      stockTaxes: incrementalTax,
      takeHome: sumField("takeHome"),
      expenses: sumField("expenses"),
      surplus: sumField("surplus"),
      stockContribution: sumField("stockContribution"),
      openingBalance: yearOpening,
      investmentGain: sumField("investmentGain"),
      endingBalance: last.endingBalance,
      healthPremiums: sumField("healthPremiums"),
      benefits:
        sumField("healthPremiums") +
        sumField("retirementContribution") +
        sumField("hsaContribution"),
      healthcareOffset: sumField("healthcareOffset"),
      budgetExpenses: sumField("budgetExpenses"),
      heldContribution: sumField("heldContribution"),
      retirementContribution: sumField("retirementContribution"),
      hsaContribution: sumField("hsaContribution"),
      forfeitedEquity: sumField("forfeitedEquity"),
      unrealizedGain: last.unrealizedGain,
      balances: { ...last.balances },
      taxBreakdown: fullTax,
      months,
    });
  }
  if (
    Number(s.benefits.retirement) +
      Number(s.benefits.hsa) +
      Number(s.benefits.health) >
      rows[0].base + rows[0].bonus + 0.01 ||
    (s.taxProfile.filing === "joint" &&
      Number(s.spouseBenefits.retirement) +
        Number(s.spouseBenefits.hsa) +
        Number(s.spouseBenefits.health) >
        rows[0].spouseCash + 0.01)
  )
    warnings.add(
      "Benefit contributions are capped at available monthly cash pay. Results show actual contributions, which can be lower than annual targets.",
    );
  return {
    rows,
    months: allMonths,
    equity,
    starting,
    startingTotal: accountTotal(starting),
    warnings: [...warnings],
  };
}
