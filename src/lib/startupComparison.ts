import type { ScenarioV2 } from "./planner";

export function startupScenarioView(scenario: ScenarioV2): ScenarioV2 {
  return {
    ...scenario,
    grants: scenario.grants.filter(
      (grant) => grant.presetCompensation !== "tech-quick",
    ),
    events: scenario.events.filter((event) => !event.presetProgression),
  };
}

export interface StartupInputs {
  ownership: string;
  grant: string;
  strike: string;
  currentPrice: string;
  currentPriceType: "unknown" | "common" | "preferred";
  dilution: string;
  vesting: string;
  vestMonths: string;
  cliffMonths: string;
  exitMode: "share" | "company";
  exit: string;
}
export const emptyStartup: StartupInputs = {
  ownership: "",
  grant: "",
  strike: "",
  currentPrice: "",
  currentPriceType: "unknown",
  dilution: "",
  vesting: "",
  vestMonths: "",
  cliffMonths: "",
  exitMode: "share",
  exit: "",
};
export interface StartupSession {
  scenario: number | null;
  inputs: [StartupInputs, StartupInputs];
}
export function emptyStartupSession(): StartupSession {
  return { scenario: null, inputs: [{ ...emptyStartup }, { ...emptyStartup }] };
}
export function parseStartupSession(value: unknown): StartupSession {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Invalid startup session");
  const session = value as Record<string, unknown>;
  if (
    ![null, 0, 1].includes(session.scenario as number | null) ||
    !Array.isArray(session.inputs) ||
    session.inputs.length !== 2
  )
    throw new Error("Invalid startup session");
  const inputs = session.inputs.map((entry: unknown) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry))
      throw new Error("Invalid startup session");
    const source = entry as Record<string, unknown>;
    for (const key of Object.keys(emptyStartup))
      if (
        typeof source[key] !== "string" ||
        (source[key] as string).length > 100
      )
        throw new Error("Invalid startup session");
    if (
      !["unknown", "common", "preferred"].includes(
        source.currentPriceType as string,
      ) ||
      !["share", "company"].includes(source.exitMode as string)
    )
      throw new Error("Invalid startup session");
    return Object.fromEntries(
      Object.keys(emptyStartup).map((key) => [key, source[key]]),
    ) as unknown as StartupInputs;
  }) as [StartupInputs, StartupInputs];
  return { scenario: session.scenario as number | null, inputs };
}
const number = (value: string) =>
  value.trim() && Number.isFinite(Number(value)) && Number(value) >= 0
    ? Number(value)
    : null;

export function fullGrantPaperSpread(input: StartupInputs) {
  const grant = number(input.grant),
    strike = number(input.strike),
    price = number(input.currentPrice);
  if (
    input.currentPriceType !== "common" ||
    grant === null ||
    !Number.isSafeInteger(grant) ||
    grant <= 0 ||
    strike === null ||
    price === null
  )
    return null;
  const spread = Math.max(0, price - strike) * grant;
  return Number.isFinite(spread) ? spread : null;
}

export function startupComparison(
  input: StartupInputs,
  years: number,
  startupComp: number,
  alternativeComp: number,
) {
  const grant = number(input.grant),
    strike = number(input.strike);
  const duration =
    input.vesting === "custom"
      ? number(input.vestMonths)
      : input.vesting.startsWith("5-")
        ? 60
        : 48;
  const cliff =
    input.vesting === "custom"
      ? number(input.cliffMonths)
      : input.vesting.endsWith("cliff") || input.vesting === "cliff"
        ? 12
        : 0;
  if (
    grant === null ||
    !Number.isSafeInteger(grant) ||
    grant <= 0 ||
    strike === null ||
    !input.vesting ||
    duration === null ||
    !Number.isInteger(duration) ||
    duration < 1 ||
    duration > 120 ||
    cliff === null ||
    !Number.isInteger(cliff) ||
    cliff > duration ||
    !Number.isInteger(years) ||
    years < 1 ||
    ![startupComp, alternativeComp].every(Number.isFinite)
  )
    return null;
  if (
    !["cliff", "monthly", "5-cliff", "5-monthly", "custom"].includes(
      input.vesting,
    )
  )
    return null;
  const elapsed = Math.min(years * 12, duration);
  const vested = elapsed < cliff ? 0 : elapsed / duration;
  const vestedOptions = grant * vested;
  const exercise = vestedOptions * strike;
  const gap = alternativeComp - startupComp;
  const breakEvenShare =
    gap <= 0 ? 0 : vestedOptions > 0 ? strike + gap / vestedOptions : null;
  const ownership = number(input.ownership),
    dilution = number(input.dilution),
    exit = number(input.exit);
  const fraction =
    ownership !== null &&
    ownership > 0 &&
    ownership <= 100 &&
    dilution !== null &&
    dilution <= 100
      ? (ownership / 100) * (1 - dilution / 100) * vested
      : null;
  const proceeds =
    exit === null
      ? null
      : input.exitMode === "share"
        ? Math.max(0, exit - strike) * vestedOptions
        : fraction === null
          ? null
          : Math.max(0, exit * fraction - exercise);
  const breakEvenCompany =
    gap <= 0
      ? 0
      : fraction !== null && fraction > 0
        ? (gap + exercise) / fraction
        : null;
  const difference = proceeds === null ? null : proceeds - gap;
  if (
    ![
      vestedOptions,
      exercise,
      gap,
      breakEvenShare ?? 0,
      fraction ?? 0,
      proceeds ?? 0,
      breakEvenCompany ?? 0,
      difference ?? 0,
    ].every(Number.isFinite)
  )
    return null;
  return {
    vestedOptions,
    exercise,
    gap,
    breakEvenShare,
    fraction,
    proceeds,
    breakEvenCompany,
    difference,
  };
}
