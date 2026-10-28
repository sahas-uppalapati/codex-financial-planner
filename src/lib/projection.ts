import type { ProjectionRow } from "./model";
import type { AssumptionsV2, Benefits, RetirementTargets, ScenarioV2 } from "./planner";
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
import { annualAge, annualRetirementLimits, employeeDeferralLimit, iraEligibility } from "./retirement";
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
  if (s.events.some((event) => event.kind === "job"))
    warnings.add(
      "Employer match settings apply only to the initial employer. No match is assumed after a job change until plan settings can be entered for that employer.",
    );
  let role = s.role,
    issuerId = s.employerId,
    annualBase = Number(s.base),
    annualBonus = Number(s.bonus),
    growth = Number(s.growth),
    roleStart = 0,
    initialEmployerActive = true;
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
      hsaCap =
        (s.taxProfile.hsaCoverage === "none"
          ? 0
          : s.taxProfile.hsaCoverage === "self"
            ? retirementLimits.hsaSelf * (s.taxProfile.filing === "joint" ? 2 : 1) + primaryHsaCatchUp + (s.taxProfile.filing === "joint" ? spouseHsaCatchUp : 0)
            : retirementLimits.hsaFamily + primaryHsaCatchUp + (s.taxProfile.filing === "joint" ? spouseHsaCatchUp : 0));
    const usedPrimary = { retirement: 0, traditionalRetirement: 0, hsa: 0 },
      usedSpouse = { retirement: 0, traditionalRetirement: 0, hsa: 0 };
    const cashMonths: CashMonth[] = [];
  let accruedBonus = 0;
    let annualMatchUsed = 0;
    for (let within = 0; within < 12; within++) {
      const month = year * 12 + within,
        e = events.find((e) => monthIndex(e.month, startYear) === month);
      if (e) {
        if (e.kind === "job") initialEmployerActive = false;
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
      const primaryMedicareActive = primaryAge !== null && primaryAge >= retirementLimits.medicareAge && s.retirementProfiles.primary.medicareMonth !== "" && within >= Number(s.retirementProfiles.primary.medicareMonth) - 1;
      const spouseMedicareActive = spouseAge !== null && spouseAge >= retirementLimits.medicareAge && s.retirementProfiles.spouse.medicareMonth !== "" && within >= Number(s.retirementProfiles.spouse.medicareMonth) - 1;
      const primary = allocateBenefits(
        base + bonus,
        s.benefits,
        usedPrimary,
        primaryRetirementCap,
        retirementLimits.employeeDeferral,
        primaryPriorYearFicaWages > retirementLimits.rothCatchUpWageThreshold && primaryAge !== null && primaryAge >= 50,
        primaryMedicareActive ? 0 : s.taxProfile.hsaCoverage === "self"
          ? retirementLimits.hsaSelf + primaryHsaCatchUp
          : Math.max(0, hsaCap - usedSpouse.hsa),
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
          ? retirementLimits.hsaSelf + spouseHsaCatchUp
          : Math.max(0, hsaCap - usedPrimary.hsa),
        monthlyRetirementTarget(s.retirementTargets.spouse, spouseCash),
      );
      const match = s.employerMatch;
      const eligiblePay = base;
      const employeeRate = eligiblePay > 0 ? ((primary.retirement + (primary.roth401k ?? 0)) / eligiblePay) * 100 : 0;
      let matchAmount = 0;
      if (initialEmployerActive && match.type === "simple") {
        matchAmount = Math.min(employeeRate, Number(match.payPercent)) * Number(match.rate) / 100 * eligiblePay / 100;
      } else if (initialEmployerActive && match.type === "tiered") {
        let bandStart = 0;
        for (const tier of match.tiers) {
          const bandEnd = bandStart + Number(tier.payPercent);
          const covered = Math.max(0, Math.min(employeeRate, bandEnd) - bandStart);
          matchAmount += covered * Number(tier.rate) / 100 * eligiblePay / 100;
          bandStart = bandEnd;
        }
      }
      if (!initialEmployerActive || match.type === "unsure" || match.type === "none") matchAmount = 0;
      if (Number(match.cap) > 0) matchAmount = Math.min(matchAmount, Math.max(0, Number(match.cap) - annualMatchUsed));
      annualMatchUsed += matchAmount;
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
    const employeeDeferrals = sum(cashMonths.map((m) => m.primary.retirement + (m.primary.roth401k ?? 0)));
    const employerContributions = sum(cashMonths.map((m) => m.employerMatch));
    const regularDeferrals = Math.min(employeeDeferrals, retirementLimits.employeeDeferral);
    const eligibleCompensation = Math.min(annualCash, retirementLimits.compensationCap);
    const megaRoom = Math.max(0, Math.min(retirementLimits.annualAdditions, eligibleCompensation) - regularDeferrals - employerContributions);
    const primaryRequested = eligibleIraRequests(
      s.retirementTargets.primary,
      primaryEligibility,
      ownerIraBalances.primary,
      megaRoom,
    );
    const spouseRequested = s.taxProfile.filing === "joint"
      ? eligibleIraRequests(s.retirementTargets.spouse, spouseEligibility, ownerIraBalances.spouse, Math.max(0, megaRoom - Number(s.retirementTargets.primary.megaBackdoor)))
      : { traditional: 0, roth: 0, backdoor: 0, megaBackdoor: 0 };
    const annualExpenses = sum(cashMonths.map((m) => totalBudget(s) * (1 + Number(a.inflation) / 100) ** year - Math.min(Number(s.expenses.healthcare) * (1 + Number(a.inflation) / 100) ** year, m.health)));
    const baselineAnnualSurplus = sum(cashMonths.map((m) => m.cashGross - m.health - m.retirement - m.roth401k - m.hsa - annualExpenses / 12)) - baselineCashTax.total;
    const iraFundingCapacity = Math.max(0, balances.taxable + baselineAnnualSurplus);
    const primaryTotal = sumRequest(primaryRequested);
    const primaryRatio = primaryTotal ? Math.min(1, iraFundingCapacity / primaryTotal) : 0;
    const primaryFunded = fundIraRequests(primaryRequested, primaryTotal * primaryRatio, primaryEligibility.deductibleTraditionalLimit);
    const spouseCapacity = Math.max(0, iraFundingCapacity - sumRequest(primaryFunded));
    const spouseTotal = sumRequest(spouseRequested);
    const spouseRatio = spouseTotal ? Math.min(1, spouseCapacity / spouseTotal) : 0;
    const spouseFunded = fundIraRequests(spouseRequested, spouseTotal * spouseRatio, spouseEligibility.deductibleTraditionalLimit);
    const rawTargetTotal = (owner: "primary" | "spouse") => {
      const target = s.retirementTargets[owner];
      return Number(target.traditionalIra) + Number(target.rothIra) + Number(target.backdoorRoth) + Number(target.megaBackdoor);
    };
    const primaryDeduction = primaryFunded.deductibleTraditional;
    const spouseDeduction = spouseFunded.deductibleTraditional;
    cashMonths.forEach((m) => {
      m.primary.deductibleIra = primaryDeduction / 12;
      m.spouse.deductibleIra = spouseDeduction / 12;
      m.traditionalIra = (primaryFunded.traditional + spouseFunded.traditional) / 12;
      m.primaryTraditionalIra = primaryFunded.traditional / 12;
      m.spouseTraditionalIra = spouseFunded.traditional / 12;
      m.rothIra = (primaryFunded.roth + spouseFunded.roth + primaryFunded.convertedBackdoor + spouseFunded.convertedBackdoor) / 12;
      m.backdoor = (primaryFunded.convertedBackdoor + spouseFunded.convertedBackdoor) / 12;
      m.megaBackdoor = (primaryFunded.convertedMegaBackdoor + spouseFunded.convertedMegaBackdoor) / 12;
      m.megaBackdoorInPlan = (s.retirementTargets.primary.megaBackdoorRoute === "in-plan" ? primaryFunded.convertedMegaBackdoor : 0) / 12 + (s.retirementTargets.spouse.megaBackdoorRoute === "in-plan" ? spouseFunded.convertedMegaBackdoor : 0) / 12;
      m.megaBackdoorRollover = (s.retirementTargets.primary.megaBackdoorRoute === "roth-ira" ? primaryFunded.convertedMegaBackdoor : 0) / 12 + (s.retirementTargets.spouse.megaBackdoorRoute === "roth-ira" ? spouseFunded.convertedMegaBackdoor : 0) / 12;
      m.deductibleIra = (primaryDeduction + spouseDeduction) / 12;
      m.unfundedIra = Math.max(0, rawTargetTotal("primary") - sumRequest(primaryFunded)) / 12 + Math.max(0, rawTargetTotal("spouse") - sumRequest(spouseFunded)) / 12;
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
      accountBalances["traditional-401k"] += c.retirement + c.employerMatch;
      accountBalances["roth-401k"] += c.roth401k + c.megaBackdoorInPlan;
      accountBalances["traditional-ira"] += c.traditionalIra;
      accountBalances["roth-ira"] += c.rothIra + c.megaBackdoorRollover;
      accountBalances.hsa += c.hsa;
      balances.retirement = sumAccountBalances(accountBalances, false);
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
        employerMatch: c.employerMatch,
        hsaContribution: c.hsa,
        stockContribution,
        heldContribution,
        forfeitedEquity,
        investmentGain,
        unrealizedGain,
        balances: { ...balances },
        accountBalances: { ...accountBalances },
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
      hsaContribution: sumField("hsaContribution"),
      forfeitedEquity: sumField("forfeitedEquity"),
      unrealizedGain: last.unrealizedGain,
      balances: { ...last.balances },
      accountBalances: { ...last.accountBalances },
      taxBreakdown: fullTax,
      months,
    });
    primaryPriorYearFicaWages = initialEmployerActive
      ? sum(cashMonths.map((m) => m.base + m.bonus - m.primary.health))
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
