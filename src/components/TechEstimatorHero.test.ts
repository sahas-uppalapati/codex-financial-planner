import { describe, expect, it } from "vitest";
import type { Grant } from "../lib/planner";
import { preserveUserGrants } from "./TechEstimatorHero";

function grant(id: string, patch: Partial<Grant> = {}): Grant {
  return {
    id,
    name: "Initial 4-Year New Hire Grant",
    issuerId: "employer",
    employmentId: "initial",
    month: "2026-01",
    units: "dollars",
    value: "100000",
    priceMode: "modeled",
    grantPrice: "150",
    schedule: [],
    template: "quarterly",
    treatment: "sell",
    keepOnDeparture: false,
    ...patch,
  };
}

describe("preserveUserGrants", () => {
  it("preserves user grants even when their name matches the preset grant", () => {
    const userGrant = grant("manual");
    const presetGrant = grant("preset", { presetCompensation: "amazon" });

    expect(preserveUserGrants([userGrant, presetGrant])).toEqual([userGrant]);
  });
});
