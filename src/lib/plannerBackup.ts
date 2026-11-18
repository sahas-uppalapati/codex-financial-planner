import { loadPlanner, PLANNER_KEY, savePlanner } from "./plannerStorage";
import type { PlannerV2 } from "./planner";

const FORMAT = "careerworth-plan";
const FORMAT_VERSION = 2;
import {
  emptyStartupSession,
  parseStartupSession,
  type StartupSession,
} from "./startupComparison";
export interface PlannerSession {
  planner: PlannerV2;
  startup: StartupSession;
}
export const MAX_BACKUP_BYTES = 5 * 1024 * 1024;

/** Export only a valid, restorable plan; drafts stay in the editor. */
export function exportPlannerBackup(
  state: PlannerV2,
  startup: StartupSession = emptyStartupSession(),
): string {
  const checkedStartup = parseStartupSession(startup);
  let saved = "";
  if (
    !savePlanner(
      {
        getItem: () => null,
        setItem: (_key, value) => {
          saved = value;
        },
      },
      state,
    )
  ) {
    throw new Error("Fix invalid inputs before exporting a backup.");
  }
  // Also apply the same calculation checks used when a saved plan is loaded.
  const checked = loadPlanner({
    getItem: (key) => (key === PLANNER_KEY ? saved : null),
    setItem: () => {},
  });
  if (checked.message.startsWith("Saved inputs could not"))
    throw new Error("This plan could not be exported.");
  return JSON.stringify(
    {
      format: FORMAT,
      version: FORMAT_VERSION,
      planner: JSON.parse(saved),
      startup: checkedStartup,
    },
    null,
    2,
  );
}

/** Validate and migrate a backup before returning it; never write to browser storage here. */
export function importPlannerBackup(raw: string): PlannerSession {
  if (new TextEncoder().encode(raw).byteLength > MAX_BACKUP_BYTES)
    throw new Error("Backup is too large.");
  try {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== "object" || Array.isArray(data))
      throw new Error();
    const backup = data as Record<string, unknown>;
    if (
      backup.format !== FORMAT ||
      ![1, FORMAT_VERSION].includes(backup.version as number) ||
      !backup.planner ||
      typeof backup.planner !== "object" ||
      Array.isArray(backup.planner)
    )
      throw new Error();
    const planner = backup.planner as Record<string, unknown>;
    if (planner.version !== 2 && planner.version !== 3) throw new Error();
    const saved = JSON.stringify(planner);
    const result = loadPlanner({
      getItem: (key) => (key === PLANNER_KEY ? saved : null),
      setItem: () => {},
    });
    if (result.message.startsWith("Saved inputs could not")) throw new Error();
    return {
      planner: result.state,
      startup:
        backup.version === 1
          ? emptyStartupSession()
          : parseStartupSession(backup.startup),
    };
  } catch {
    throw new Error(
      "This is not a valid or supported CareerWorth backup. Your current plan was not changed.",
    );
  }
}
