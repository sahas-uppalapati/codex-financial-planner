import type { RetirementTargets } from "./planner";
import type { IraEligibility } from "./retirement";

export interface IraContributionRequest {
  traditional: number;
  roth: number;
  backdoor: number;
  megaBackdoor: number;
}

export interface IraContributionFunding extends IraContributionRequest {
  deductibleTraditional: number;
  convertedBackdoor: number;
  convertedMegaBackdoor: number;
  unfunded: IraContributionRequest;
}

export function eligibleIraRequests(
  targets: RetirementTargets,
  eligibility: IraEligibility,
  aggregateIraBalance: number,
  megaBackdoorRoom: number,
): IraContributionRequest {
  const iraLimit = eligibility.contributionLimit;
  const traditional = Math.min(Number(targets.traditionalIra), iraLimit);
  const roth = Math.min(Number(targets.rothIra), eligibility.rothContributionLimit, Math.max(0, iraLimit - traditional));
  const canBackdoor = targets.backdoorConfirmed && targets.iraBalanceZeroConfirmed && aggregateIraBalance <= 0 && traditional <= 0;
  const backdoor = canBackdoor ? Math.min(Number(targets.backdoorRoth), Math.max(0, iraLimit - traditional - roth)) : 0;
  const canMega = targets.megaBackdoorSupported && targets.megaBackdoorRoute !== "none";
  const megaBackdoor = canMega ? Math.min(Number(targets.megaBackdoor), Math.max(0, megaBackdoorRoom)) : 0;
  return { traditional, roth, backdoor, megaBackdoor };
}

const routes: (keyof IraContributionRequest)[] = ["traditional", "roth", "backdoor", "megaBackdoor"];

/** Funds in requested proportions, then reports the amount that could not be funded. */
export function fundIraRequests(
  requested: IraContributionRequest,
  availableFunds: number,
  deductibleTraditionalLimit: number,
): IraContributionFunding {
  const total = routes.reduce((sum, key) => sum + requested[key], 0);
  const fundedRatio = total > 0 ? Math.min(1, Math.max(0, availableFunds) / total) : 0;
  const result = Object.fromEntries(routes.map((key) => [key, requested[key] * fundedRatio])) as unknown as IraContributionRequest;
  const deductibleTraditional = Math.min(result.traditional, Math.max(0, deductibleTraditionalLimit));
  return {
    ...result,
    deductibleTraditional,
    convertedBackdoor: result.backdoor,
    convertedMegaBackdoor: result.megaBackdoor,
    unfunded: Object.fromEntries(routes.map((key) => [key, requested[key] - result[key]])) as unknown as IraContributionRequest,
  };
}
