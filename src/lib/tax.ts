import { california, federal, newYork } from "../data/taxRules";
import type { FilingStatus, TaxProfile } from "./planner";
export interface WorkerTaxInput {
  cash: number;
  stock: number;
  retirement: number;
  roth401k?: number;
  deductibleIra?: number;
  health: number;
  hsa: number;
}
export interface TaxBreakdown {
  gross: number;
  federalTaxable: number;
  stateTaxable: number;
  federalIncome: number;
  stateIncome: number;
  localIncome: number;
  socialSecurity: number;
  medicare: number;
  additionalMedicare: number;
  employeePremiums: number;
  manual: number;
  total: number;
  effective: number;
}
export function bracketTax(
  income: number,
  upper: number[],
  rates: number[],
  bases?: number[],
): number {
  const amount = Math.max(0, income);
  let lower = 0,
    tax = 0;
  for (let i = 0; i < upper.length; i++) {
    if (amount <= upper[i])
      return bases
        ? bases[i] + (amount - lower) * rates[i]
        : tax + (amount - lower) * rates[i];
    if (!bases) tax += (upper[i] - lower) * rates[i];
    lower = upper[i];
  }
  return tax;
}
function nyStateTax(
  agi: number,
  taxable: number,
  filing: FilingStatus,
): number {
  const regular = bracketTax(
    taxable,
    newYork[filing],
    newYork.rates,
    filing === "single" ? newYork.singleBases : newYork.jointBases,
  );
  let result = regular;
  if (agi > 25000000) result = 0.109 * taxable;
  else if (agi > 107650) {
    const rows =
      filing === "single"
        ? [
            [215400, 0, 567, 107650],
            [1077550, 567, 2047, 215400],
            [5000000, 2614, 30172, 1077550],
            [25000000, 32786, 32500, 5000000],
          ]
        : [
            [161550, 0, 333, 107650],
            [323200, 333, 807, 161550],
            [2155350, 1140, 3071, 323200],
            [5000000, 4211, 60350, 2155350],
            [25000000, 64561, 32500, 5000000],
          ];
    const special = filing === "single" ? 80650 : 27900;
    if (taxable < special)
      result +=
        Math.max(0, taxable * (filing === "single" ? 0.059 : 0.054) - regular) *
        Math.min(1, (agi - 107650) / 50000);
    else {
      const row = rows.find((r) => taxable <= r[0]);
      if (row)
        result +=
          row[1] + row[2] * Math.max(0, Math.min(1, (agi - row[3]) / 50000));
    }
  }
  const credits =
    filing === "single"
      ? [
          [5000, 75],
          [6000, 60],
          [7000, 50],
          [20000, 45],
          [25000, 40],
          [28000, 20],
        ]
      : [
          [5000, 105],
          [6000, 90],
          [7000, 80],
          [20000, 75],
          [22000, 70],
          [25000, 60],
          [28000, 45],
          [32000, 25],
        ];
  return Math.max(0, result - (credits.find((r) => agi <= r[0])?.[1] ?? 0));
}
function nyCityTax(agi: number, taxable: number, filing: FilingStatus): number {
  const joint = filing === "joint";
  let tax = bracketTax(
    taxable,
    joint ? [21600, 45000, 90000, Infinity] : [12000, 25000, 50000, Infinity],
    [0.03078, 0.03762, 0.03819, 0.03876],
    joint ? [0, 665, 1545, 3264] : [0, 369, 858, 1813],
  );
  const household = joint
    ? [
        [15000, 60],
        [17500, 50],
        [20000, 30],
        [22500, 20],
      ]
    : [
        [10000, 15],
        [12500, 10],
      ];
  tax = Math.max(0, tax - (household.find((r) => agi <= r[0])?.[1] ?? 0));
  if (agi <= 250000) tax -= joint ? 125 : 63;
  if (agi <= 500000) {
    const threshold = joint ? 21600 : 12000;
    tax -=
      taxable <= threshold
        ? 0.00171 * taxable
        : (joint ? 37 : 21) + 0.00228 * (taxable - threshold);
  }
  return Math.max(0, tax); // This planning model does not pay out refundable credits beyond liability.
}
export function calculateTaxes(
  workers: WorkerTaxInput[],
  profile: TaxProfile,
  calendarYear: number,
  inflation: number,
  manualRate = 0,
): TaxBreakdown {
  const active = workers.slice(0, profile.filing === "joint" ? 2 : 1);
  if (
    !active.length ||
    active.some((w) =>
      Object.values(w).some((v) => v !== undefined && (!Number.isFinite(v) || v < 0)),
    ) ||
    !Number.isInteger(calendarYear) ||
    calendarYear < 2026 ||
    !Number.isFinite(inflation) ||
    inflation < 0 ||
    inflation > 10 ||
    !Number.isFinite(manualRate) ||
    manualRate < 0 ||
    manualRate > 100
  )
    throw new RangeError("Invalid tax inputs");
  const scale = (1 + inflation / 100) ** (calendarYear - 2026),
    idx = (x: number) => (x === Infinity ? Infinity : x * scale);
  const total = (pick: (w: WorkerTaxInput) => number) =>
    active.reduce((sum, w) => sum + pick(w), 0);
  const gross = total((w) => w.cash + w.stock),
    wages = active.map((w) => Math.max(0, w.cash + w.stock - w.health - w.hsa));
  const agis = active.map((w) =>
      Math.max(0, w.cash + w.stock - w.health - w.hsa - w.retirement - (w.deductibleIra ?? 0)),
    ),
    agi = agis.reduce((a, b) => a + b, 0);
  const filing = profile.filing,
    joint = filing === "joint";
  const federalTaxable = Math.max(0, agi - idx(federal.deduction[filing]));
  const result: TaxBreakdown = {
    gross,
    federalTaxable,
    stateTaxable: 0,
    federalIncome: 0,
    stateIncome: 0,
    localIncome: 0,
    socialSecurity: 0,
    medicare: 0,
    additionalMedicare: 0,
    employeePremiums: 0,
    manual: 0,
    total: 0,
    effective: 0,
  };
  if (profile.mode === "manual") {
    result.manual = (agi * manualRate) / 100;
    result.total = Math.max(
      0,
      result.manual +
        Number(profile.federalAdjustment) +
        Number(profile.stateAdjustment) +
        Number(profile.localAdjustment),
    );
    result.effective = gross ? result.total / gross : 0;
    return result;
  }
  result.federalIncome = Math.max(
    0,
    bracketTax(federalTaxable, federal[filing].map(idx), federal.rates) +
      Number(profile.federalAdjustment),
  );
  result.socialSecurity = wages.reduce(
    (sum, w) => sum + 0.062 * Math.min(w, idx(federal.socialSecurityCap)),
    0,
  );
  result.medicare = wages.reduce((sum, w) => sum + 0.0145 * w, 0);
  result.additionalMedicare =
    0.009 *
    Math.max(0, wages.reduce((a, b) => a + b, 0) - (joint ? 250000 : 200000));
  const location = profile.location;
  if (location === "san-francisco") {
    const caAgi = agi + total((w) => w.hsa);
    result.stateTaxable = Math.max(
      0,
      caAgi - idx(california.deduction[filing]),
    );
    const reductions =
      6 *
      (joint ? 2 : 1) *
      Math.ceil(
        Math.max(0, agi - idx(california.creditPhaseout[filing])) / 2500,
      );
    const credit = Math.max(
      0,
      idx(california.personalCredit[filing]) - reductions,
    );
    result.stateIncome =
      Math.max(
        0,
        bracketTax(
          result.stateTaxable,
          california[filing].map(idx),
          california.rates,
        ) - credit,
      ) +
      0.01 * Math.max(0, result.stateTaxable - 1000000);
    if (profile.employeePremiums)
      result.employeePremiums =
        total((w) => Math.max(0, w.cash + w.stock - w.health)) * 0.013;
  } else if (location === "new-york") {
    result.stateTaxable = Math.max(0, agi - newYork.deduction[filing]);
    result.stateIncome = nyStateTax(agi, result.stateTaxable, filing);
    result.localIncome = nyCityTax(agi, result.stateTaxable, filing);
    if (profile.employeePremiums)
      result.employeePremiums = total((w) =>
        Math.min((w.cash + w.stock) * 0.00432, idx(411.91)),
      );
    if (profile.nyDisability)
      result.employeePremiums += total((w) =>
        Math.min((w.cash + w.stock) * 0.005, 31.2),
      );
  } else if (location === "columbus") {
    const perPerson =
      agi <= 40000 ? 2400 : agi <= 80000 ? 2150 : agi < 500000 ? 1900 : 0;
    result.stateTaxable = Math.max(0, agi - perPerson * active.length);
    let state =
      result.stateTaxable <= 26050
        ? 0
        : 332 + 0.0275 * (result.stateTaxable - 26050);
    if (result.stateTaxable < 30000)
      state = Math.max(0, state - 20 * active.length);
    if (joint && agis.every((a) => a >= 500) && agi < 500000) {
      const rate =
        result.stateTaxable <= 25000
          ? 0.2
          : result.stateTaxable <= 50000
            ? 0.15
            : result.stateTaxable <= 75000
              ? 0.1
              : 0.05;
      state -= Math.min(650, state * rate);
    }
    result.stateIncome = state;
    result.localIncome = wages.reduce((a, b) => a + b, 0) * 0.025;
  } else if (location === "boston") {
    const ficaDeduction = wages.reduce(
      (sum, w) =>
        sum +
        Math.min(
          2000,
          0.062 * Math.min(w, idx(federal.socialSecurityCap)) + 0.0145 * w,
        ),
      0,
    );
    result.stateTaxable = Math.max(
      0,
      agi - (joint ? 8800 : 4400) - ficaDeduction,
    );
    const regular =
      0.05 * result.stateTaxable +
      0.04 * Math.max(0, result.stateTaxable - idx(1107750));
    const threshold = joint ? 16400 : 8000,
      ceiling = joint ? 28700 : 14000;
    result.stateIncome =
      agi <= threshold
        ? 0
        : agi <= ceiling
          ? Math.min(regular, 0.1 * (agi - threshold))
          : regular;
    if (profile.employeePremiums)
      result.employeePremiums =
        total((w) =>
          Math.min(w.cash + w.stock, idx(federal.socialSecurityCap)),
        ) * 0.0046;
  } else if (location === "seattle") {
    if (profile.employeePremiums)
      result.employeePremiums =
        total((w) =>
          Math.min(w.cash + w.stock, idx(federal.socialSecurityCap)),
        ) * 0.00807159;
    if (!profile.waCaresExempt) result.employeePremiums += gross * 0.0058;
  } else if (location !== "austin")
    throw new RangeError("Unsupported tax location");
  result.stateIncome = Math.max(
    0,
    result.stateIncome + Number(profile.stateAdjustment),
  );
  result.localIncome = Math.max(
    0,
    result.localIncome + Number(profile.localAdjustment),
  );
  result.total =
    result.federalIncome +
    result.stateIncome +
    result.localIncome +
    result.socialSecurity +
    result.medicare +
    result.additionalMedicare +
    result.employeePremiums;
  result.effective = gross ? result.total / gross : 0;
  if (!Object.values(result).every(Number.isFinite))
    throw new RangeError("Non-finite tax result");
  return result;
}
