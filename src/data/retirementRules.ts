export interface RetirementRuleSource {
  title: string;
  url: string;
  taxYear: 2026;
  verifiedOn: string;
}

export const retirementRuleSources: RetirementRuleSource[] = [
  {
    title: "IRS 2026 cost-of-living adjustments (Notice 2025-67)",
    url: "https://www.irs.gov/pub/irs-drop/n-25-67.pdf",
    taxYear: 2026,
    verifiedOn: "2026-10-27",
  },
  {
    title: "IRS Publication 590-A: contributions to IRAs",
    url: "https://www.irs.gov/publications/p590a",
    taxYear: 2026,
    verifiedOn: "2026-10-27",
  },
  {
    title: "IRS Publication 969: HSAs",
    url: "https://www.irs.gov/publications/p969",
    taxYear: 2026,
    verifiedOn: "2026-10-27",
  },
  {
    title: "IRS catch-up contribution final regulations",
    url: "https://www.irs.gov/irb/2025-40_IRB",
    taxYear: 2026,
    verifiedOn: "2026-10-27",
  },
];

export const retirementRules2026 = {
  year: 2026,
  employeeDeferral: 24_500,
  catchUp: 8_000,
  catchUpAge60To63: 11_250,
  catchUpAge60To63: 11_250,
  annualAdditions: 72_000,
  compensationCap: 360_000,
  rothCatchUpPriorYearWages: 150_000,
  iraContribution: 7_500,
  iraCatchUp: 1_100,
  iraRothPhaseout: {
    single: [153_000, 168_000] as const,
    joint: [242_000, 252_000] as const,
  },
  iraDeductionPhaseout: {
    coveredSingle: [81_000, 91_000] as const,
    coveredJoint: [129_000, 149_000] as const,
    uncoveredWithCoveredSpouseJoint: [242_000, 252_000] as const,
    coveredSeparate: [0, 10_000] as const,
  },
  hsaSelf: 4_400,
  hsaFamily: 8_750,
  hsaCatchUp: 1_000,
  medicareAge: 65,
  source: retirementRuleSources[0],
};
