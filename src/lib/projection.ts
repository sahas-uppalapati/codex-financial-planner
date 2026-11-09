import type { ProjectionRow } from "./model";
import type { AssumptionsV2, Benefits, EmployerMatch, RetirementTargets, ScenarioV2 } from "./planner";
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
import type { RetirementAccountType } from "./retirement";
import { retirementAccountLabels } from "./retirement";
import { annualAge, annualRetirementLimits, employeeDeferralLimit, iraEligibility, matchVestedPercent } from "./retirement";
import { eligibleIraRequests, fundIraRequests } from "./retirementContributions";
import type { IraContributionRequest } from "./retirementContributions";
export type RetirementAccountBalances = Record<RetirementAccountType, number>;
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
  roth401kContribution: number;
  traditionalIraContribution: number;
  rothIraContribution: number;
  backdoorRothConversion: number;
  megaBackdoorContribution: number;
  deductibleIraContribution: number;
  unfundedIraContribution: number;
  employerMatch: number;
  forfeitedMatch: number;
  unvestedMatch: number;
  hsaContribution: number;
  stockContribution: number;
  heldContribution: number;
  forfeitedEquity: number;
  investmentGain: number;
  unrealizedGain: number;
  balances: AccountBalances;
  accountBalances: RetirementAccountBalances;
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
  roth401kContribution: number;
  traditionalIraContribution: number;
  rothIraContribution: number;
  backdoorRothConversion: number;
  megaBackdoorContribution: number;
  deductibleIraContribution: number;
  unfundedIraContribution: number;
  employerMatch: number;
  forfeitedMatch: number;
  unvestedMatch: number;
  hsaContribution: number;
  forfeitedEquity: number;
  unrealizedGain: number;
  balances: AccountBalances;
  accountBalances: RetirementAccountBalances;
  taxBreakdown: TaxBreakdown;
  months: MonthlyRow[];
}
export interface Projection {
  rows: AnnualRow[];
  months: MonthlyRow[];
  equity: EquityPlan;
  starting: AccountBalances;
  startingAccountBalances: RetirementAccountBalances;
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
  roth401k: number;
  employerMatch: number;
  match: EmployerMatch;
  spouseMatch: number;
  employerStartMonth: number;
  jobChange: boolean;
  hsa: number;
  traditionalIra: number;
  primaryTraditionalIra: number;
  spouseTraditionalIra: number;
  rothIra: number;
  backdoor: number;
  megaBackdoor: number;
  megaBackdoorInPlan: number;
  megaBackdoorRollover: number;
  deductibleIra: number;
  unfundedIra: number;
}
const sum = (items: number[]) => items.reduce((a, b) => a + b, 0);
function calculateEmployerMatch(match: EmployerMatch, pay: number, contribution: number, used: number): number {
  const employeeRate = pay > 0 ? contribution / pay * 100 : 0;
  let amount = 0;
  if (match.type === "simple") {
    amount = Math.min(employeeRate, Number(match.payPercent)) * Number(match.rate) / 100 * pay / 100;
  } else if (match.type === "tiered") {
    let start = 0;
    for (const tier of match.tiers) {
      const end = start + Number(tier.payPercent);
      amount += Math.max(0, Math.min(employeeRate, end) - start) * Number(tier.rate) / 100 * pay / 100;
      start = end;
    }
  }
  return Number(match.cap) > 0 ? Math.min(amount, Math.max(0, Number(match.cap) - used)) : amount;
}
const accountTotal = (a: AccountBalances) =>
  a.taxable + a.employerStock + a.retirement + a.hsa;
const accountTypes = Object.keys(retirementAccountLabels) as RetirementAccountType[];
const sumAccountBalances = (accounts: RetirementAccountBalances, includeHsa: boolean) =>
  accountTypes.reduce((total, type) => total + (includeHsa || type !== "hsa" ? accounts[type] : 0), 0);
function monthlyRetirementTarget(target: RetirementTargets, eligiblePay: number) {
  const total = target.workplace401k.mode === "percent"
    ? eligiblePay * Number(target.workplace401k.amount) / 100
    : Number(target.workplace401k.amount) / 12;
  return {
    traditional: total * Number(target.workplace401k.traditionalSharePercent) / 100,
    roth: total * Number(target.workplace401k.rothSharePercent) / 100,
  };
}
function allocateBenefits(
  cash: number,
  b: Benefits,
  used: { retirement: number; traditionalRetirement: number; hsa: number },
  retirementCap: number,
  traditionalDeferralCap: number,
  requiredRothCatchUp: boolean,
  hsaCap: number,
  retirementTargets: { traditional: number; roth: number },
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
  const availableRetirement = Math.min(remaining, Math.max(0, retirementCap - used.retirement));
  const requestedRetirement = retirementTargets.traditional + retirementTargets.roth;
  let retirement: number, roth401k: number;
  if (requiredRothCatchUp) {
    retirement = Math.min(retirementTargets.traditional, availableRetirement, Math.max(0, traditionalDeferralCap - used.traditionalRetirement));
    roth401k = Math.min(availableRetirement - retirement, Math.max(0, requestedRetirement - retirement));
  } else {
    retirement = Math.min(retirementTargets.traditional, availableRetirement);
    roth401k = Math.min(retirementTargets.roth, availableRetirement - retirement);
  }
  used.retirement += retirement + roth401k;
  used.traditionalRetirement += retirement;
  return { cash, stock: 0, health, hsa, retirement, roth401k };
}
function combineWorkers(
  months: CashMonth[],
  who: "primary" | "spouse",
  stock = 0,
  deductibleIra = 0,
): WorkerTaxInput {
  return {
    cash: sum(months.map((m) => m[who].cash)),
    stock,
    health: sum(months.map((m) => m[who].health)),
    retirement: sum(months.map((m) => m[who].retirement)),
    roth401k: sum(months.map((m) => m[who].roth401k ?? 0)),
    hsa: sum(months.map((m) => m[who].hsa)),
    deductibleIra,
  };
}

function sumRequest(request: IraContributionRequest): number {
  return request.traditional + request.roth + request.backdoor + request.megaBackdoor;
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
  const startingAccountBalances = Object.fromEntries(accountTypes.map((type) => [type, 0])) as RetirementAccountBalances;
  for (const account of a.startingAccounts) {
    startingAccountBalances[account.type] += Number(account.balance);
  }
  startingAccountBalances["traditional-401k"] += Number(a.startingRetirement) + Number(a.startingSpouseRetirement);
  startingAccountBalances.hsa += Number(a.startingHsa) + Number(a.startingSpouseHsa);
  const starting: AccountBalances = {
    taxable: Number(a.starting),
    employerStock: sum(
      s.issuers.map((i) => Number(i.startingShares) * Number(i.price)),
    ),
    retirement: sumAccountBalances(startingAccountBalances, false),
    hsa: startingAccountBalances.hsa,
  };
  const balances: AccountBalances = { ...starting };
  const accountBalances: RetirementAccountBalances = { ...startingAccountBalances };
  const ownerIraBalances = {
    primary: a.startingAccounts.filter((account) => account.owner === "primary" && ["traditional-ira", "sep-ira", "simple-ira"].includes(account.type)).reduce((total, account) => total + Number(account.balance), 0),
    spouse: a.startingAccounts.filter((account) => account.owner === "spouse" && ["traditional-ira", "sep-ira", "simple-ira"].includes(account.type)).reduce((total, account) => total + Number(account.balance), 0),
  };
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
    signOnY1 = Math.max(0, Number(s.signOnY1) || 0),
    signOnY2 = Math.max(0, Number(s.signOnY2) || 0),
    growth = Number(s.growth),
    roleStart = 0;
  let activeMatch = s.employerMatch;
  let employerStartMonth = 0;
  let employerMatchBalance = 0;
  let spouseMatchBalance = 0;
  let balanceMatch = activeMatch;
  let balanceEmployerStartMonth = employerStartMonth;
  let primaryPriorYearFicaWages = Number(s.retirementProfiles.primary.priorYearFicaWages);
  let spousePriorYearFicaWages = Number(s.retirementProfiles.spouse.priorYearFicaWages);
  for (let year = 0; year < years; year++) {
    const calendarYear = startYear + year,
      retirementLimits = annualRetirementLimits(calendarYear, Number(a.taxInflation));
    const primaryAge = annualAge(s.retirementProfiles.primary, year),
      spouseAge = annualAge(s.retirementProfiles.spouse, year),
      primaryRetirementCap = employeeDeferralLimit(retirementLimits, primaryAge, s.retirementProfiles.primary.allowsCatchUp === true),
      spouseRetirementCap = employeeDeferralLimit(retirementLimits, spouseAge, s.retirementProfiles.spouse.allowsCatchUp === true),
      primaryHsaCatchUp = primaryAge !== null && primaryAge >= 55 ? retirementLimits.hsaCatchUp : 0,
      spouseHsaCatchUp = spouseAge !== null && spouseAge >= 55 ? retirementLimits.hsaCatchUp : 0,
      // Medicare enrollment is modeled in the year the owner turns 65 and remains active afterward.
      eligibleMonths = (age: number | null, month: string) =>
        age === null || month === "" || age < retirementLimits.medicareAge
          ? 12
          : age > retirementLimits.medicareAge ? 0 : Number(month) - 1,
      primaryHsaMonths = eligibleMonths(primaryAge, s.retirementProfiles.primary.medicareMonth),
      spouseHsaMonths = s.taxProfile.filing === "joint" ? eligibleMonths(spouseAge, s.retirementProfiles.spouse.medicareMonth) : 0,
      baseHsaLimit = s.taxProfile.hsaCoverage === "self" ? retirementLimits.hsaSelf : s.taxProfile.hsaCoverage === "family" ? retirementLimits.hsaFamily : 0,
      primaryHsaCap = (baseHsaLimit + (baseHsaLimit ? primaryHsaCatchUp : 0)) * primaryHsaMonths / 12,
      spouseHsaCap = (baseHsaLimit + (baseHsaLimit ? spouseHsaCatchUp : 0)) * spouseHsaMonths / 12,
      hsaCap = s.taxProfile.hsaCoverage === "family"
        ? baseHsaLimit * Math.max(primaryHsaMonths, spouseHsaMonths) / 12 + primaryHsaCatchUp * primaryHsaMonths / 12 + spouseHsaCatchUp * spouseHsaMonths / 12
        : primaryHsaCap + spouseHsaCap;
    const usedPrimary = { retirement: 0, traditionalRetirement: 0, hsa: 0 },
      usedSpouse = { retirement: 0, traditionalRetirement: 0, hsa: 0 };
    const cashMonths: CashMonth[] = [];
  let accruedBonus = 0;
    let annualMatchUsed = 0;
    let annualSpouseMatchUsed = 0;
    for (let within = 0; within < 12; within++) {
      const month = year * 12 + within;
      const e = events.find((e) => monthIndex(e.month, startYear) === month);
      if (e) {
        if (e.kind === "job") {
          employerStartMonth = month;
          activeMatch = e.employerMatch ?? s.employerMatch;
          annualMatchUsed = 0;
        }
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
      let monthlySignOn = 0;
      if (year === 0 && within === 0) {
        monthlySignOn = signOnY1;
      } else if (year === 1) {
        monthlySignOn = signOnY2 / 12;
      }
      accruedBonus += annualBonus / 12;
      const bonus = (within === 11 ? accruedBonus : 0) + monthlySignOn;
      const spouseCash =
        s.taxProfile.filing === "joint"
          ? (Number(s.taxProfile.spouseWages) *
              (1 + Number(s.taxProfile.spouseGrowth) / 100) ** year) /
            12
          : 0;
      const primaryMedicareActive = within >= primaryHsaMonths;
      const spouseMedicareActive = within >= spouseHsaMonths;
      const primary = allocateBenefits(
        base + bonus,
        s.benefits,
        usedPrimary,
        primaryRetirementCap,
        retirementLimits.employeeDeferral,
        primaryPriorYearFicaWages > retirementLimits.rothCatchUpWageThreshold && primaryAge !== null && primaryAge >= 50,
        primaryMedicareActive ? 0 : s.taxProfile.hsaCoverage === "self"
          ? primaryHsaCap
          : Math.min(primaryHsaCap, Math.max(0, hsaCap - usedSpouse.hsa)),
        monthlyRetirementTarget(s.retirementTargets.primary, base),
      );
      const spouse = allocateBenefits(
        spouseCash,
        s.taxProfile.filing === "joint"
          ? s.spouseBenefits
          : { retirement: "0", hsa: "0", health: "0" },
        usedSpouse,
        spouseRetirementCap,
        retirementLimits.employeeDeferral,
        spousePriorYearFicaWages > retirementLimits.rothCatchUpWageThreshold && spouseAge !== null && spouseAge >= 50,
        spouseMedicareActive ? 0 : s.taxProfile.hsaCoverage === "self"
          ? spouseHsaCap
          : Math.min(spouseHsaCap, Math.max(0, hsaCap - usedPrimary.hsa)),
        monthlyRetirementTarget(s.retirementTargets.spouse, spouseCash),
      );
      const match = activeMatch;
      const matchAmount = calculateEmployerMatch(match, base, primary.retirement + (primary.roth401k ?? 0), annualMatchUsed);
      const spouseMatch = calculateEmployerMatch(s.spouseEmployerMatch, spouseCash, spouse.retirement + (spouse.roth401k ?? 0), annualSpouseMatchUsed);
      annualMatchUsed += matchAmount;
      annualSpouseMatchUsed += spouseMatch;
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
        roth401k: (primary.roth401k ?? 0) + (spouse.roth401k ?? 0),
        employerMatch: matchAmount,
        spouseMatch,
        match,
        employerStartMonth,
        jobChange: e?.kind === "job",
        hsa: primary.hsa + spouse.hsa,
        traditionalIra: 0,
        primaryTraditionalIra: 0,
        spouseTraditionalIra: 0,
        rothIra: 0,
        backdoor: 0,
        megaBackdoor: 0,
        megaBackdoorInPlan: 0,
        megaBackdoorRollover: 0,
        deductibleIra: 0,
        unfundedIra: 0,
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
    const annualCash = sum(cashMonths.map((m) => m.cashGross));
    const baselineCashTax = calculateTaxes(
      [primary, spouse],
      s.taxProfile,
      calendarYear,
      Number(a.taxInflation),
      s.taxProfile.mode === "manual" ? Number(s.tax) : 0,
    );
    const aggregateMagi = annualCash + annualStock - primary.retirement - primary.health - primary.hsa - spouse.retirement - spouse.health - spouse.hsa;
    const primaryEligibility = iraEligibility({
      filing: s.taxProfile.filing,
      modifiedAgi: aggregateMagi,
      ownTaxableCompensation: sum(cashMonths.map((m) => m.base + m.bonus)),
      spouseTaxableCompensation: s.taxProfile.filing === "joint" ? sum(cashMonths.map((m) => m.spouseCash)) : 0,
      age: primaryAge,
      limits: retirementLimits,
      ownWorkplaceCoverage: s.retirementProfiles.primary.workplacePlanCoverage,
      spouseWorkplaceCoverage: s.retirementProfiles.spouse.workplacePlanCoverage,
    });
    const spouseEligibility = iraEligibility({
      filing: s.taxProfile.filing,
      modifiedAgi: aggregateMagi,
      ownTaxableCompensation: s.taxProfile.filing === "joint" ? sum(cashMonths.map((m) => m.spouseCash)) : 0,
      spouseTaxableCompensation: sum(cashMonths.map((m) => m.base + m.bonus)),
      age: spouseAge,
      limits: retirementLimits,
      ownWorkplaceCoverage: s.retirementProfiles.spouse.workplacePlanCoverage,
      spouseWorkplaceCoverage: s.retirementProfiles.primary.workplacePlanCoverage,
    });
    const megaRoom = (owner: "primary" | "spouse") => {
      const deferrals = sum(cashMonths.map((m) => m[owner].retirement + (m[owner].roth401k ?? 0)));
      const matches = sum(cashMonths.map((m) => owner === "primary" ? m.employerMatch : m.spouseMatch));
      const pay = sum(cashMonths.map((m) => owner === "primary" ? m.base + m.bonus : m.spouseCash));
      const eligibleCompensation = Math.min(pay, retirementLimits.compensationCap);
      return Math.max(0, Math.min(retirementLimits.annualAdditions, eligibleCompensation) - Math.min(deferrals, retirementLimits.employeeDeferral) - matches);
    };
    const primaryRequested = eligibleIraRequests(
      s.retirementTargets.primary,
      primaryEligibility,
      ownerIraBalances.primary,
      megaRoom("primary"),
    );
    const spouseRequested = s.taxProfile.filing === "joint"
      ? eligibleIraRequests(s.retirementTargets.spouse, spouseEligibility, ownerIraBalances.spouse, megaRoom("spouse"))
      : { traditional: 0, roth: 0, backdoor: 0, megaBackdoor: 0 };
    // Funding reserves pre-IRA taxes; savings from funded deductions stay in taxable cash.
    const baselineFullTax = calculateTaxes(
      [{ ...primary, stock: annualStock }, spouse], s.taxProfile, calendarYear,
      Number(a.taxInflation), s.taxProfile.mode === "manual" ? Number(s.tax) : 0,
    );
    const monthlyRequest = (request: IraContributionRequest): IraContributionRequest => ({
      traditional: request.traditional / 12, roth: request.roth / 12,
      backdoor: request.backdoor / 12, megaBackdoor: request.megaBackdoor / 12,
    });
    const primaryMonthlyRequest = monthlyRequest(primaryRequested);
    const spouseMonthlyRequest = monthlyRequest(spouseRequested);
    const rawTargetTotal = (owner: "primary" | "spouse") => {
      const target = s.retirementTargets[owner];
      return Number(target.traditionalIra) + Number(target.rothIra) + Number(target.backdoorRoth) + Number(target.megaBackdoor);
    };
    let fundingCash = balances.taxable;
    let primaryDeduction = 0, spouseDeduction = 0;
    cashMonths.forEach((m, within) => {
      const inflation = (1 + Number(a.inflation) / 100) ** year;
      const expenses = totalBudget(s) * inflation - Math.min(Number(s.expenses.healthcare) * inflation, m.health);
      const cashTaxes = annualCash > 0 ? baselineCashTax.total * m.cashGross / annualCash : baselineCashTax.total / 12;
      const equityCash = sum(vestMonths[within].map((v) => {
        // Reserve the full baseline liability for equity cash as a conservative
        // bound: an IRA deduction can change how tax is attributed to a vest.
        const tax = annualStock > 0 ? baselineFullTax.total * v.value / annualStock : 0;
        return v.treatment === "sell" ? v.value - tax : -Math.max(0, tax - v.value);
      }));
      fundingCash += Math.max(0, fundingCash) * monthlyReturn + m.cashGross - m.health - m.retirement - m.roth401k - m.hsa - cashTaxes - expenses + equityCash;
      const payrollRequest = (request: IraContributionRequest, worker: WorkerTaxInput): IraContributionRequest => {
        const workerTax = m.cashGross > 0 ? cashTaxes * worker.cash / m.cashGross : 0;
        const payrollRoom = Math.max(0, worker.cash - worker.health - worker.retirement - (worker.roth401k ?? 0) - worker.hsa - workerTax);
        return { ...request, megaBackdoor: Math.min(request.megaBackdoor, payrollRoom) };
      };
      const primaryFunded = fundIraRequests(payrollRequest(primaryMonthlyRequest, m.primary), Math.max(0, fundingCash), Math.max(0, primaryEligibility.deductibleTraditionalLimit - primaryDeduction));
      fundingCash -= sumRequest(primaryFunded);
      const spouseFunded = fundIraRequests(payrollRequest(spouseMonthlyRequest, m.spouse), Math.max(0, fundingCash), Math.max(0, spouseEligibility.deductibleTraditionalLimit - spouseDeduction));
      fundingCash -= sumRequest(spouseFunded);
      primaryDeduction += primaryFunded.deductibleTraditional;
      spouseDeduction += spouseFunded.deductibleTraditional;
      m.primary.deductibleIra = primaryFunded.deductibleTraditional;
      m.spouse.deductibleIra = spouseFunded.deductibleTraditional;
      m.traditionalIra = primaryFunded.traditional + spouseFunded.traditional;
      m.primaryTraditionalIra = primaryFunded.traditional;
      m.spouseTraditionalIra = spouseFunded.traditional;
      m.rothIra = primaryFunded.roth + spouseFunded.roth + primaryFunded.convertedBackdoor + spouseFunded.convertedBackdoor;
      m.backdoor = primaryFunded.convertedBackdoor + spouseFunded.convertedBackdoor;
      m.megaBackdoor = primaryFunded.convertedMegaBackdoor + spouseFunded.convertedMegaBackdoor;
      m.megaBackdoorInPlan = (s.retirementTargets.primary.megaBackdoorRoute === "in-plan" ? primaryFunded.convertedMegaBackdoor : 0) + (s.retirementTargets.spouse.megaBackdoorRoute === "in-plan" ? spouseFunded.convertedMegaBackdoor : 0);
      m.megaBackdoorRollover = (s.retirementTargets.primary.megaBackdoorRoute === "roth-ira" ? primaryFunded.convertedMegaBackdoor : 0) + (s.retirementTargets.spouse.megaBackdoorRoute === "roth-ira" ? spouseFunded.convertedMegaBackdoor : 0);
      m.deductibleIra = primaryFunded.deductibleTraditional + spouseFunded.deductibleTraditional;
      m.unfundedIra = Math.max(0, rawTargetTotal("primary") / 12 - sumRequest(primaryFunded)) + (s.taxProfile.filing === "joint" ? Math.max(0, rawTargetTotal("spouse") / 12 - sumRequest(spouseFunded)) : 0);
    });
    const primaryWithIra = combineWorkers(cashMonths, "primary", 0, primaryDeduction),
      spouseWithIra = combineWorkers(cashMonths, "spouse", 0, spouseDeduction);
    const cashTax = calculateTaxes(
      [primaryWithIra, spouseWithIra], s.taxProfile, calendarYear,
      Number(a.taxInflation), s.taxProfile.mode === "manual" ? Number(s.tax) : 0,
    );
    const fullTax = calculateTaxes(
      [{ ...primaryWithIra, stock: annualStock }, spouseWithIra],
      s.taxProfile,
      calendarYear,
      Number(a.taxInflation),
      s.taxProfile.mode === "manual" ? Number(s.tax) : 0,
    );
    const incrementalTax = fullTax.total - cashTax.total;
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
        c.cashGross - c.health - c.retirement - c.roth401k - c.hsa - cashTaxes;
      const inflation = (1 + Number(a.inflation) / 100) ** year;
      const budgetExpenses = totalBudget(s) * inflation;
      const healthcareOffset = Math.min(
        Number(s.expenses.healthcare) * inflation,
        c.health,
      );
      const expenses = budgetExpenses - healthcareOffset,
        surplus = takeHome - expenses - c.traditionalIra - c.rothIra - c.megaBackdoor;
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
      let forfeitedMatch = 0;
      if (c.jobChange) {
        const completedYears = Math.max(0, Math.floor((month - balanceEmployerStartMonth) / 12));
        forfeitedMatch = employerMatchBalance * (100 - matchVestedPercent(balanceMatch, completedYears)) / 100;
        accountBalances["traditional-401k"] -= forfeitedMatch;
        employerMatchBalance = 0;
        balanceMatch = c.match;
        balanceEmployerStartMonth = c.employerStartMonth;
      }
      const investmentGain =
        Math.max(0, balances.taxable) * monthlyReturn +
        balances.retirement * monthlyReturn +
        balances.hsa * monthlyReturn;
      balances.taxable +=
        Math.max(0, balances.taxable) * monthlyReturn +
        surplus +
        stockContribution;
      for (const type of accountTypes)
        accountBalances[type] *= 1 + monthlyReturn;
      ownerIraBalances.primary *= 1 + monthlyReturn;
      ownerIraBalances.spouse *= 1 + monthlyReturn;
      ownerIraBalances.primary += c.primaryTraditionalIra;
      ownerIraBalances.spouse += c.spouseTraditionalIra;
      accountBalances["traditional-401k"] += c.retirement + c.employerMatch + c.spouseMatch;
      accountBalances["roth-401k"] += c.roth401k + c.megaBackdoorInPlan;
      accountBalances["traditional-ira"] += c.traditionalIra;
      accountBalances["roth-ira"] += c.rothIra + c.megaBackdoorRollover;
      accountBalances.hsa += c.hsa;
      employerMatchBalance *= 1 + monthlyReturn;
      employerMatchBalance += c.employerMatch;
      spouseMatchBalance = spouseMatchBalance * (1 + monthlyReturn) + c.spouseMatch;
      const completedYearsAtMonthEnd = Math.max(
        0,
        Math.floor((month - c.employerStartMonth + 1) / 12),
      );
      const vestedPctAtMonthEnd = matchVestedPercent(
        c.match,
        completedYearsAtMonthEnd,
      );
      const spouseVestedPct = matchVestedPercent(s.spouseEmployerMatch, Math.floor((month + 1) / 12));
      const monthlyUnvestedMatch =
        (employerMatchBalance * Math.max(0, 100 - vestedPctAtMonthEnd) + spouseMatchBalance * Math.max(0, 100 - spouseVestedPct)) / 100;
      const ownedAccounts = { ...accountBalances, "traditional-401k": accountBalances["traditional-401k"] - monthlyUnvestedMatch };
      balances.retirement = sumAccountBalances(ownedAccounts, false);
      balances.hsa = accountBalances.hsa;
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
        roth401kContribution: c.roth401k,
        traditionalIraContribution: c.traditionalIra,
        rothIraContribution: c.rothIra,
        backdoorRothConversion: c.backdoor,
        megaBackdoorContribution: c.megaBackdoor,
        deductibleIraContribution: c.deductibleIra,
        unfundedIraContribution: c.unfundedIra,
        employerMatch: c.employerMatch + c.spouseMatch,
        forfeitedMatch,
        unvestedMatch: monthlyUnvestedMatch,
        hsaContribution: c.hsa,
        stockContribution,
        heldContribution,
        forfeitedEquity,
        investmentGain,
        unrealizedGain,
        balances: { ...balances },
        accountBalances: ownedAccounts,
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
        sumField("roth401kContribution") +
        sumField("hsaContribution"),
      healthcareOffset: sumField("healthcareOffset"),
      budgetExpenses: sumField("budgetExpenses"),
      heldContribution: sumField("heldContribution"),
      retirementContribution: sumField("retirementContribution"),
      roth401kContribution: sumField("roth401kContribution"),
      traditionalIraContribution: sumField("traditionalIraContribution"),
      rothIraContribution: sumField("rothIraContribution"),
      backdoorRothConversion: sumField("backdoorRothConversion"),
      megaBackdoorContribution: sumField("megaBackdoorContribution"),
      deductibleIraContribution: sumField("deductibleIraContribution"),
      unfundedIraContribution: sumField("unfundedIraContribution"),
      employerMatch: sumField("employerMatch"),
      forfeitedMatch: sumField("forfeitedMatch"),
      unvestedMatch: last.unvestedMatch,
      hsaContribution: sumField("hsaContribution"),
      forfeitedEquity: sumField("forfeitedEquity"),
      unrealizedGain: last.unrealizedGain,
      balances: { ...last.balances },
      accountBalances: { ...last.accountBalances },
      taxBreakdown: fullTax,
      months,
    });
    primaryPriorYearFicaWages =
      employerStartMonth < year * 12
        ? sum(cashMonths.map((m) => m.employer === last.employer ? m.base + m.bonus - m.primary.health : 0))
        : 0;
    spousePriorYearFicaWages = sum(cashMonths.map((m) => m.spouseCash - m.spouse.health));
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
    startingAccountBalances,
    startingTotal: accountTotal(starting),
    warnings: [...warnings],
  };
}
