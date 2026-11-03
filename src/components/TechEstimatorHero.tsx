import { useState, useEffect } from "react";
import type { AssumptionsV2, ScenarioV2, TaxLocation } from "../lib/planner";
import { taxLocations } from "../lib/planner";
import {
  techCompanies,
  techLevels,
  growthPresets,
  housingPresets,
  findTechCompPoint,
  getTechProgressionTimeline,
  buildTechProgressionEvents,
} from "../data/techCompPresets";
import type { GrowthPreset } from "../data/techCompPresets";
import { templateSchedule } from "../data/vesting";
import { uid } from "../lib/planner";
import { money } from "../lib/format";

interface TechEstimatorHeroProps {
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
  onAssumptionsChange: (assumptions: AssumptionsV2) => void;
}

export function TechEstimatorHero({
  scenario,
  assumptions,
  onScenarioChange,
  onAssumptionsChange,
}: TechEstimatorHeroProps) {
  // Infer selected company if present in scenario, otherwise unset
  const initialCompany =
    techCompanies.find((c) =>
      scenario.role?.toLowerCase().includes(c.name.toLowerCase()) ||
      scenario.name?.toLowerCase().includes(c.name.toLowerCase()) ||
      scenario.issuers?.some((i) => i.name.toLowerCase().includes(c.name.toLowerCase())),
    )?.id;

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(initialCompany ?? "");
  const [selectedLevelId, setSelectedLevelId] = useState<string>(() => {
    if (!initialCompany) return "";
    const levels = techLevels[initialCompany] ?? techLevels.google;
    const matched = levels.find((l) =>
      scenario.name?.toLowerCase().includes(l.level.toLowerCase()) ||
      scenario.role?.toLowerCase().includes(l.title.toLowerCase()),
    );
    return matched?.id ?? levels[2]?.id ?? levels[0]?.id ?? "l5";
  });

  useEffect(() => {
    if (initialCompany) {
      setSelectedCompanyId(initialCompany);
      const levels = techLevels[initialCompany] || techLevels.google;
      const matchedLvl = levels.find((l) =>
        scenario.name?.toLowerCase().includes(l.level.toLowerCase()) ||
        scenario.role?.toLowerCase().includes(l.title.toLowerCase()),
      )?.id || levels[2]?.id || levels[0]?.id || "l5";
      setSelectedLevelId(matchedLvl);
    } else {
      setSelectedCompanyId("");
      setSelectedLevelId("");
    }
  }, [scenario.name, scenario.role, initialCompany]);

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
    if (selectedCompanyId) {
      applyTechPreset(selectedCompanyId, selectedLevelId || "l5", locationId, selectedFiling, activeGrowthId, includeProgression);
    } else {
      onScenarioChange({
        ...scenario,
        taxProfile: { ...scenario.taxProfile, location: locationId },
      });
    }
  }

  function handleFilingChange(filing: "single" | "joint") {
    if (selectedCompanyId) {
      applyTechPreset(selectedCompanyId, selectedLevelId || "l5", selectedLocationId, filing, activeGrowthId, includeProgression);
    } else {
      onScenarioChange({
        ...scenario,
        taxProfile: { ...scenario.taxProfile, filing },
      });
    }
  }

  function handleProgressionToggle(enabled: boolean) {
    setIncludeProgression(enabled);
    if (selectedCompanyId) {
      applyTechPreset(selectedCompanyId, selectedLevelId || "l5", selectedLocationId, selectedFiling, activeGrowthId, enabled);
    }
  }

  function handleGrowthChange(growthId: GrowthPreset["id"]) {
    const preset = growthPresets.find((g) => g.id === growthId);
    if (!preset) return;

    onAssumptionsChange({
      ...assumptions,
      returns: String(preset.returns),
      inflation: String(preset.inflation),
    });

    // Update employer stock appreciation if issuer exists
    if (scenario.issuers && scenario.issuers.length > 0) {
      onScenarioChange({
        ...scenario,
        issuers: scenario.issuers.map((issuer) => ({
          ...issuer,
          appreciation: String(preset.stockAppreciation),
        })),
      });
    }
  }

  function applyTechPreset(
    companyId: string,
    levelId: string,
    locationId: TaxLocation,
    filing: "single" | "joint",
    growthId: GrowthPreset["id"],
    progressionEnabled: boolean = includeProgression,
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
    const fourYearGrantValue = comp.annualRsu * 4;

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

    onScenarioChange(updatedScenario);
    onAssumptionsChange({
      ...assumptions,
      returns: String(growth.returns),
      inflation: String(growth.inflation),
    });
  }

  const currentLevels = techLevels[selectedCompanyId] || techLevels.google;
  const selectedCompany = techCompanies.find((c) => c.id === selectedCompanyId) || techCompanies[0];
  const selectedLocation = taxLocations.find((l) => l.id === selectedLocationId) || taxLocations[0];
  const progressionSteps = getTechProgressionTimeline(
    selectedCompanyId,
    selectedLevelId,
    selectedLocationId,
    Number(assumptions.startYear) || 2026,
    Number(assumptions.years) || 10,
  );

  return (
    <div className="tech-estimator-hero" aria-label="1-Click Big Tech Preset Selector">
      <div className="hero-section-header">
        <span className="hero-badge">⚡ 1-Click Tech Estimator</span>
        <p className="hero-subtitle">
          Select your employer, level, and location to estimate cash flow, RSU liquidity, and tax realities.
        </p>
      </div>

      <div className="hero-selector-grid">
        {/* Company Selector */}
        <div className="hero-control-group">
          <label htmlFor="tech-company-select" className="hero-label">
            Company
          </label>
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
          <label htmlFor="tech-level-select" className="hero-label">
            Level
          </label>
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

        {/* Career Progression & Promotion Timeline */}
        <div className="hero-control-group hero-full-width hero-progression-card">
          <div className="progression-card-header">
            <div className="progression-header-text">
              <span className="progression-eyebrow">Career Ladder & Progression</span>
              <strong className="progression-title">
                {selectedCompany.name} Promotion Progression
              </strong>
              <span className="progression-desc">
                Modeled on typical {selectedCompany.name} promotion timelines for {selectedLocation.label}.
              </span>
            </div>
            <label className="progression-toggle" htmlFor="progression-model-toggle">
              <input
                id="progression-model-toggle"
                type="checkbox"
                checked={includeProgression}
                onChange={(e) => handleProgressionToggle(e.target.checked)}
              />
              <span className="toggle-text">Model promotions in forecast</span>
            </label>
          </div>

          <div className={`progression-steps-container ${!includeProgression ? "dimmed" : ""}`}>
            {progressionSteps.map((step) => (
              <div
                key={step.levelId}
                className={`progression-step-item ${step.isCurrent ? "current" : "future"}`}
              >
                <div className="step-badge-row">
                  <span className={`step-badge ${step.isCurrent ? "current" : ""}`}>
                    {step.isCurrent ? "Starting Level" : `+${step.yearsFromPrev} yr${step.yearsFromPrev === 1 ? "" : "s"} (${step.monthLabel})`}
                  </span>
                  {step.compDelta > 0 && (
                    <span className="step-delta-pill">
                      +{money(step.compDelta)}
                    </span>
                  )}
                </div>
                <div className="step-level-row">
                  <strong className="step-level-name">{step.levelName}</strong>
                  <span className="step-title-text">{step.title.split(" · ")[1] || step.title}</span>
                </div>
                <div className="step-tc-row">
                  <strong className="step-tc-num">{money(step.totalComp)}</strong>
                  <span className="step-tc-unit">/ yr TC</span>
                </div>
                <div className="step-comp-sub">
                  <span>Base: {money(step.base)}</span>
                  <span className="dot-sep">·</span>
                  <span>RSU: {money(step.annualRsu)}</span>
                  {step.bonus > 0 && (
                    <>
                      <span className="dot-sep">·</span>
                      <span>Bonus: {money(step.bonus)}</span>
                    </>
                  )}
                </div>
              </div>
            ))}

            {progressionSteps.length === 1 && (
              <div className="terminal-level-notice">
                <span className="terminal-icon" aria-hidden="true">⭐</span>
                <p>
                  <strong>{selectedLevelId.toUpperCase()} is the terminal level in this track.</strong> Multi-year projections model steady Senior/Staff compensation with annual merit growth.
                </p>
              </div>
            )}
          </div>

          {!includeProgression && progressionSteps.length > 1 && (
            <p className="progression-paused-note">
              ⚠️ Modeled promotions are currently paused. Enable the toggle above to include regular promotion salary increases and equity awards in your projection.
            </p>
          )}
        </div>

        {/* Growth Outlook */}
        <div className="hero-control-group hero-full-width">
          <label className="hero-label">Market Outlook</label>
          <div className="growth-presets-row" role="group" aria-label="Growth Presets">
            {growthPresets.map((g) => (
              <button
                key={g.id}
                type="button"
                className={`growth-preset-card ${activeGrowthId === g.id ? "active" : ""}`}
                aria-pressed={activeGrowthId === g.id}
                onClick={() => handleGrowthChange(g.id)}
              >
                <div className="growth-card-top">
                  <span className="growth-icon">{g.icon}</span>
                  <strong className="growth-label">{g.shortLabel}</strong>
                </div>
                <span className="growth-sub">{g.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
