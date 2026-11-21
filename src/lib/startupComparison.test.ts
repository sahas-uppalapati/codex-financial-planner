import { expect, it } from 'vitest';
import { fullGrantPaperSpread, startupComparison, startupScenarioView, type StartupInputs } from './startupComparison';
import { defaultPlanner, type CareerEvent, type Grant } from './planner';
import { projectScenario } from './projection';

it('compares partial startup offer details using five-year vesting and optional exit assumptions', () => {
  const input: StartupInputs = { ownership: '', grant: '20000', strike: '2', currentPrice: '', currentPriceType: 'unknown', dilution: '', vesting: '5-cliff', vestMonths: '', cliffMonths: '', exitMode: 'share', exit: '10' };
  const result = startupComparison(input, 5, 600000, 800000)!;
  expect(result.exercise).toBe(40000);
  expect(result.breakEvenShare).toBeCloseTo(12);
  expect(result.proceeds).toBeCloseTo(160000);
  expect(result.fraction).toBeNull();
  expect(startupComparison(input, 5, 610000, 800000)!.breakEvenShare).toBeCloseTo(11.5);
  expect(startupComparison({ ...input, exitMode: 'company', exit: '300000000' }, 5, 600000, 800000)!.proceeds).toBeNull();
  expect(startupComparison({ ...input, vesting: 'custom', vestMonths: '60', cliffMonths: '12' }, 2, 0, 0)!.vestedOptions).toBe(8000);
  expect(startupComparison({ ...input, grant: '' }, 5, 0, 0)).toBeNull();
  expect(fullGrantPaperSpread({ ...input, strike: '2', currentPrice: '6', currentPriceType: 'common' })).toBeCloseTo(80000);
  expect(fullGrantPaperSpread({ ...input, strike: '2', currentPrice: '6', currentPriceType: 'preferred' })).toBeNull();
  expect(startupComparison({ ...input, grant: '1', exit: '1e308' }, 5, 1e308, 1e308)!.difference).toBe(1e308);
});

it('excludes preset grants and promotions from a startup projection without changing the saved scenario', () => {
  const planner = defaultPlanner();
  const scenario = planner.scenarios[0];
  scenario.base = '100000';
  scenario.growth = '0';
  scenario.stockMode = 'grants';
  scenario.grants = [{ id: 'preset', name: 'Preset', issuerId: scenario.employerId, employmentId: 'initial', month: `${planner.shared.startYear}-01`, units: 'dollars', value: '40000', priceMode: 'explicit', grantPrice: '100', schedule: [{ month: '12', percent: '100' }], template: 'custom', treatment: 'sell', keepOnDeparture: false, presetCompensation: 'tech-quick' } satisfies Grant];
  scenario.events = [{ id: 'preset-promotion', kind: 'promotion', issuerId: scenario.employerId, month: `${planner.shared.startYear}-02`, role: 'Preset role', base: '200000', bonus: '0', growth: '0', awardValue: '0', awardTemplate: 'annual', awardTreatment: 'sell', refresherValue: '0', refresherAfter: '12', refresherEvery: '12', refresherTemplate: 'annual', refresherTreatment: 'sell', presetProgression: 'google' } satisfies CareerEvent];
  const startup = startupScenarioView(scenario);
  expect(projectScenario(scenario, planner.shared).rows[0].stockGross).toBeGreaterThan(0);
  expect(projectScenario(startup, planner.shared).rows[0].stockGross).toBe(0);
  expect(projectScenario(startup, planner.shared).rows[0].base).toBeCloseTo(100000);
  expect(scenario.grants).toHaveLength(1);
  expect(scenario.events).toHaveLength(1);
});
