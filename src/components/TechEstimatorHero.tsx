import { useState, useEffect, useRef } from "react";
import type { AssumptionsV2, ScenarioV2, TaxLocation } from "../lib/planner";
import { taxLocations } from "../lib/planner";
import {
  techCompanies,
  techLevels,
  growthPresets,
  housingPresets,
  findTechCompPoint,
  buildTechProgressionEvents,
} from "../data/techCompPresets";
import type { GrowthPreset } from "../data/techCompPresets";
import { templateSchedule } from "../data/vesting";
import { uid } from "../lib/planner";

interface TechEstimatorHeroProps {
  allowInitialPreset: boolean;
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
  onAssumptionsChange: (assumptions: AssumptionsV2) => void;
}

export function TechEstimatorHero({
  allowInitialPreset,
  scenario,
  assumptions,
  onScenarioChange,
  onAssumptionsChange,
}: TechEstimatorHeroProps) {
  const initialized = useRef(false);
  // Ownership is deliberately session-only. On reload, saved values have no
  // trustworthy provenance and are therefore preserved until explicitly applied.
  const baseline = useRef<{ scenario: ScenarioV2; assumptions: AssumptionsV2; owned: Set<string> } | null>(null);
  const [preview, setPreview] = useState<{ scenario: ScenarioV2; assumptions: AssumptionsV2 } | null>(null);
  // Check if an actual tech preset is already applied (legacy default "Columbus offer" has company: "Meta" from model.ts)
  const isPresetApplied =
    scenario.name !== "Columbus offer" &&
    techCompanies.some((c) =>
      scenario.role?.toLowerCase().includes(c.name.toLowerCase()) ||
      scenario.name?.toLowerCase().includes(c.name.toLowerCase()) ||
      scenario.issuers?.some((i) => i.name.toLowerCase().includes(c.name.toLowerCase())),
    );

  const initialCompany = isPresetApplied
    ? techCompanies.find((c) =>
        scenario.role?.toLowerCase().includes(c.name.toLowerCase()) ||
        scenario.name?.toLowerCase().includes(c.name.toLowerCase()) ||
        scenario.company?.toLowerCase() === c.name.toLowerCase() ||
        scenario.issuers?.some((i) => i.name.toLowerCase().includes(c.name.toLowerCase())),
      )?.id
    : undefined;

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompany || "google");
  const [selectedLevelId, setSelectedLevelId] = useState<string>(() => {
    const compId = initialCompany || "google";
    const levels = techLevels[compId] ?? techLevels.google;
    const matched = levels.find((l) =>
      scenario.name?.toLowerCase().includes(l.level.toLowerCase()) ||
      scenario.role?.toLowerCase().includes(l.title.toLowerCase()),
    );
    return matched?.id ?? levels[2]?.id ?? levels[0]?.id ?? "l5";
  });

  useEffect(() => {
    if (!initialized.current && allowInitialPreset && !initialCompany) {
      const location = scenario.taxProfile.location === "columbus" ? "san-francisco" : scenario.taxProfile.location;
      applyTechPreset("google", "l5", location, scenario.taxProfile.filing, activeGrowthId, true, true);
    }
    initialized.current = true;
  }, []); // Initial sample only; never infer ownership from an existing save.

  useEffect(() => setPreview(null), [scenario, assumptions]);

  const selectedLocationId = scenario.taxProfile.location;
  const selectedFiling = scenario.taxProfile.filing;

  const [includeProgression, setIncludeProgression] = useState<boolean>(() => {
    return scenario.events.some((e) => Boolean(e.presetProgression)) || scenario.events.length === 0;
  });

  // Find active growth preset
  const activeGrowthId: GrowthPreset["id"] =
    Number(assumptions.returns) >= 9 ? "bull" : Number(assumptions.returns) >= 6.5 ? "moderate" : "conservative";

  function handleCompanyChange(companyId: string) {
    setSelectedCompanyId(companyId);
    const levels = techLevels[companyId] || techLevels.google;
    const defaultLevel = levels[2]?.id || levels[0]?.id || "l5";
    setSelectedLevelId(defaultLevel);
    applyTechPreset(companyId, defaultLevel, selectedLocationId, selectedFiling, activeGrowthId, includeProgression);
  }

  function handleLevelChange(levelId: string) {
    const companyId = selectedCompanyId || "google";
    setSelectedCompanyId(companyId);
    setSelectedLevelId(levelId);
    applyTechPreset(companyId, levelId, selectedLocationId, selectedFiling, activeGrowthId, includeProgression);
  }

  function handleLocationChange(locationId: TaxLocation) {
    const companyId = selectedCompanyId || "google";
    const levelId = selectedLevelId || "l5";
    setSelectedCompanyId(companyId);
    setSelectedLevelId(levelId);
    applyTechPreset(companyId, levelId, locationId, selectedFiling, activeGrowthId, includeProgression);
  }

  function handleFilingChange(filing: "single" | "joint") {
    const companyId = selectedCompanyId || "google";
    const levelId = selectedLevelId || "l5";
    setSelectedCompanyId(companyId);
    setSelectedLevelId(levelId);
    applyTechPreset(companyId, levelId, selectedLocationId, filing, activeGrowthId, includeProgression);
  }

  function handleProgressionToggle(enabled: boolean) {
    setIncludeProgression(enabled);
    if (selectedCompanyId) {
      applyTechPreset(selectedCompanyId, selectedLevelId || "l5", selectedLocationId, selectedFiling, activeGrowthId, enabled, false, false, ["events"]);
    }
  }

  function handleGrowthChange(growthId: GrowthPreset["id"]) {
    const growth = growthPresets.find((item) => item.id === growthId);
    if (!growth) return;
    const shared = { ...assumptions, returns: String(growth.returns) };
    if (baseline.current) {
      baseline.current = { ...baseline.current, assumptions: shared, owned: new Set([...baseline.current.owned, "returns"]) };
    }
    onAssumptionsChange(shared);
  }

  function applyTechPreset(
    companyId: string,
    levelId: string,
    locationId: TaxLocation,
    filing: "single" | "joint",
    growthId: GrowthPreset["id"],
    progressionEnabled: boolean = includeProgression,
    fullApply = false,
    previewOnly = false,
    forced: string[] = [],
  ) {
    const company = techCompanies.find((c) => c.id === companyId) || techCompanies[0];
    const levels = techLevels[companyId] || techLevels.google;
    const level = levels.find((l) => l.id === levelId) || levels[0];
    const comp = findTechCompPoint(companyId, levelId, locationId);
    const housing = housingPresets[locationId] || housingPresets["san-francisco"];
    const living = filing === "joint" ? housing.family : housing.single;
    const growth = growthPresets.find((g) => g.id === growthId) || growthPresets[0];

    // Setup 4-year grant and issuer for the detailed model
    const issuerId = scenario.employerId || uid();
    const grantId = uid();
    const vestingTemplate = company.defaultVestingTemplate;
    const fourYearGrantValue = comp.grantTotal ?? (comp.annualRsu * 4);

    const newIssuer = {
      id: issuerId,
      name: `${company.name} (${company.ticker})`,
      price: "150",
      appreciation: String(growth.stockAppreciation),
      startingShares: "0",
      startingBasis: "0",
    };

    const startYear = assumptions.startYear || "2026";
    const newGrant = {
      id: grantId,
      name: `Initial 4-Year New Hire Grant`,
      issuerId,
      employmentId: "initial",
      month: `${startYear}-01`,
      units: "dollars" as const,
      value: String(fourYearGrantValue),
      priceMode: "modeled" as const,
      grantPrice: "150",
      schedule: templateSchedule(vestingTemplate),
      template: vestingTemplate,
      treatment: "sell" as const,
      keepOnDeparture: false,
      presetCompensation: "tech-quick",
    };

    const events = progressionEnabled
      ? buildTechProgressionEvents(
          companyId,
          levelId,
          locationId,
          issuerId,
          Number(assumptions.startYear) || 2026,
          Number(assumptions.years) || 10,
          scenario.events,
          scenario.growth || "0",
        )
      : scenario.events.filter((e) => !e.presetProgression);

    const updatedScenario: ScenarioV2 = {
      ...scenario,
      employerId: issuerId,
      name: `${company.name} ${level.level}`,
      role: `${level.title} at ${company.name}`,
      company: company.name,
      base: String(comp.base),
      bonus: String(comp.bonus),
      stock: String(comp.annualRsu),
      signOnY1: String(comp.signOnY1 ?? 0),
      signOnY2: String(comp.signOnY2 ?? 0),
      stockMode: "grants",
      includeStock: comp.annualRsu > 0,
      issuers: [newIssuer],
      grants: comp.annualRsu > 0 ? [newGrant] : [],
      events,
      taxProfile: {
        ...scenario.taxProfile,
        location: locationId,
        filing,
      },
      expenses: {
        housing: String(living.rent),
        food: String(Math.round(living.livingExpenses * 0.4)),
        transportation: String(Math.round(living.livingExpenses * 0.2)),
        healthcare: String(Math.round(living.livingExpenses * 0.15)),
        other: String(Math.round(living.livingExpenses * 0.25)),
      },
      employerMatch: {
        type: "simple",
        rate: String(company.matchPolicy.rate),
        payPercent: String(company.matchPolicy.payPercentCap ?? "6"),
        cap: String(company.matchPolicy.dollarCap ?? "0"),
        tiers: [],
        vestingType: "immediate",
        vestingSchedule: ["100"],
      },
    };

    const updatedAssumptions = {
      ...assumptions,
      returns: String(growth.returns),
      inflation: String(growth.inflation),
    };
    if (previewOnly) {
      setPreview({ scenario: updatedScenario, assumptions: updatedAssumptions });
      return;
    }
    applyCandidate(updatedScenario, updatedAssumptions, fullApply, forced);
  }

  function applyCandidate(candidate: ScenarioV2, nextAssumptions: AssumptionsV2, fullApply: boolean, forced: string[] = []) {
    const keys = ["name", "role", "company", "base", "bonus", "stock", "signOnY1", "signOnY2", "stockMode", "includeStock", "employerId", "issuers", "grants", "events", "expenses", "employerMatch"] as const;
    const old = baseline.current;
    const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);
    const owned = new Set<string>();
    const result = { ...scenario };
    for (const key of keys) {
      if (fullApply || forced.includes(key) || (old?.owned.has(key) && same(scenario[key], old.scenario[key]))) {
        // Keep linked stock settings together when the corresponding grants or
        // issuer have been customized, rather than orphaning a user's grant.
        const linkedStock = ["stock", "stockMode", "includeStock", "employerId", "issuers", "grants"].includes(key);
        const stockSafe = fullApply || !linkedStock || (["stock", "stockMode", "includeStock", "employerId", "issuers", "grants"] as const).every(
          (field) => old?.owned.has(field) && same(scenario[field], old.scenario[field]),
        );
        if (stockSafe) {
          Object.assign(result, { [key]: candidate[key] });
          owned.add(key);
        }
      }
    }
    // Location and household are explicit controls, not inferred preset edits.
    result.taxProfile = { ...scenario.taxProfile, location: candidate.taxProfile.location, filing: candidate.taxProfile.filing };
    const shared = { ...assumptions };
    for (const key of ["returns", "inflation"] as const) {
      if (fullApply || forced.includes(key) || (old?.owned.has(key) && same(assumptions[key], old.assumptions[key]))) {
        shared[key] = nextAssumptions[key];
        owned.add(key);
      }
    }
    baseline.current = { scenario: result, assumptions: shared, owned };
    onScenarioChange(result);
    onAssumptionsChange(shared);
  }

  const currentLevels = techLevels[selectedCompanyId] || techLevels.google;
  const selectedCompany = techCompanies.find((c) => c.id === selectedCompanyId) || techCompanies[0];
  const selectedLocation = taxLocations.find((l) => l.id === selectedLocationId) || taxLocations[0];

  return (
    <div className="tech-estimator-hero" aria-label="Big Tech Preset Selector">
      <div className="hero-selector-grid">
        {/* Company Selector */}
        <div className="hero-control-group">
          <label className="hero-label">Company</label>
          <div className="pill-selector" role="group" aria-label="Big Tech Company">
            {techCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pill-btn ${selectedCompanyId === c.id ? "active" : ""}`}
                aria-pressed={selectedCompanyId === c.id}
                onClick={() => handleCompanyChange(c.id)}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        {/* Level Selector */}
        <div className="hero-control-group">
          <label className="hero-label">Level</label>
          <div className="pill-selector" role="group" aria-label="Job Level">
            {currentLevels.map((lvl) => (
              <button
                key={lvl.id}
                type="button"
                className={`pill-btn ${selectedLevelId === lvl.id ? "active" : ""}`}
                aria-pressed={selectedLevelId === lvl.id}
                onClick={() => handleLevelChange(lvl.id)}
                title={lvl.title}
              >
                {lvl.level}
              </button>
            ))}
          </div>
        </div>

        {/* Location Selector */}
        <div className="hero-control-group">
          <label htmlFor="tech-location-select" className="hero-label">
            Location
          </label>
          <select
            id="tech-location-select"
            className="hero-select"
            value={selectedLocationId}
            onChange={(e) => handleLocationChange(e.target.value as TaxLocation)}
          >
            {taxLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filing & Household Status */}
        <div className="hero-control-group">
          <label className="hero-label">Household</label>
          <div className="pill-selector" role="group" aria-label="Household structure">
            <button
              type="button"
              className={`pill-btn ${selectedFiling === "single" ? "active" : ""}`}
              aria-pressed={selectedFiling === "single"}
              onClick={() => handleFilingChange("single")}
            >
              Single
            </button>
            <button
              type="button"
              className={`pill-btn ${selectedFiling === "joint" ? "active" : ""}`}
              aria-pressed={selectedFiling === "joint"}
              onClick={() => handleFilingChange("joint")}
            >
              Married / Family
            </button>
          </div>
        </div>

        {/* Growth Outlook */}
        <div className="hero-control-group">
          <label className="hero-label">Market Outlook</label>
          <div className="pill-selector" role="group" aria-label="Market Outlook">
            {growthPresets.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`pill-btn ${activeGrowthId === g.id ? "active" : ""}`}
                aria-pressed={activeGrowthId === g.id}
                onClick={() => handleGrowthChange(g.id)}
                title={g.description}
              >
                {g.shortLabel}
              </button>
            ))}
          </div>
        </div>

        {/* Career Progression Toggle - One-line checkmark */}
        <div className="hero-control-group hero-full-width">
          <label className="progression-checkbox-label" htmlFor="progression-model-toggle">
            <input
              id="progression-model-toggle"
              type="checkbox"
              checked={includeProgression}
              onChange={(e) => handleProgressionToggle(e.target.checked)}
              title={`Typical ${selectedCompany.name} promotion timeline and compensation progression for ${selectedLocation.label}.`}
            />
            <span className="progression-label-text">
              Model {selectedCompany.name} promotions in forecast
            </span>
          </label>
        </div>
      </div>
      <p className="hint">Preset changes keep values you have customized. Saved values are kept unless you choose to replace them. Market outlook changes the investment return only.</p>
      <button type="button" className="secondary small" onClick={() => applyTechPreset(selectedCompanyId, selectedLevelId, selectedLocationId, selectedFiling, activeGrowthId, includeProgression, false, true)}>
        Preview full preset
      </button>
      {preview && (
        <div className="preset-preview" role="region" aria-label="Full preset preview">
          <strong>Replace values with this preset?</strong>
          <p>This replaces the scenario name, pay, bonuses, stock grants and employers (including any starting shares and cost basis), living costs, match, generated promotions, and market assumptions. Review these estimates before applying.</p>
          <ul>
            <li>Annual salary: {scenario.base} → {preview.scenario.base}</li>
            <li>Annual bonus: {scenario.bonus} → {preview.scenario.bonus}</li>
            <li>Annual stock: {scenario.stock} → {preview.scenario.stock}</li>
            <li>Sign-on bonuses (years 1 / 2): {scenario.signOnY1} / {scenario.signOnY2} → {preview.scenario.signOnY1} / {preview.scenario.signOnY2}</li>
            <li>Employer: {scenario.issuers.map((i) => i.name).join(", ") || "None"} → {preview.scenario.issuers.map((i) => i.name).join(", ") || "None"}</li>
            <li>Stock grants: {scenario.grants.length} → {preview.scenario.grants.length} (existing grants will be replaced)</li>
            <li>Career events: {scenario.events.length} → {preview.scenario.events.length} (manual events are retained)</li>
            <li>Employer match: {scenario.employerMatch.type} → {preview.scenario.employerMatch.rate}% up to {preview.scenario.employerMatch.payPercent}% of pay</li>
            <li>Monthly living costs: {Object.values(scenario.expenses).reduce((n, v) => n + (Number(v) || 0), 0)} → {Object.values(preview.scenario.expenses).reduce((n, v) => n + (Number(v) || 0), 0)}</li>
            <li>Investment return: {assumptions.returns}% → {preview.assumptions.returns}%</li>
            <li>Expense inflation: {assumptions.inflation}% → {preview.assumptions.inflation}%</li>
          </ul>
          <button type="button" onClick={() => { applyCandidate(preview.scenario, preview.assumptions, true); setPreview(null); }}>Apply full preset</button>{" "}
          <button type="button" className="text-button" onClick={() => setPreview(null)}>Cancel</button>
        </div>
      )}
    </div>
  );
}
