import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { useState, useEffect, useRef } from "react";
import type { AssumptionsV2, ScenarioV2, TaxLocation } from "../lib/planner";
import { taxLocations } from "../lib/planner";
import {
  techCompanies,
  techLevels,
  growthPresets,
  growthPresetForReturn,
  companyEmployerMatch,
  quickOffer,
  housingPresets,
  findTechCompPoint,
  techCompensationScope,
  buildTechProgressionEvents,
} from "../data/techCompPresets";
import type { CompanyPreset, GrowthPreset } from "../data/techCompPresets";
import { findCompensationPreset, locationPresets } from "../data/presets";
import { templateSchedule } from "../data/vesting";
import { uid } from "../lib/planner";

interface TechEstimatorHeroProps {
  allowInitialPreset: boolean;
  scenario: ScenarioV2;
  assumptions: AssumptionsV2;
  onScenarioChange: (scenario: ScenarioV2) => void;
  onAssumptionsChange: (assumptions: AssumptionsV2) => void;
}

function availableLevels(companyId: string, locationId: TaxLocation) {
  return (techLevels[companyId] || techLevels.google).filter((level) =>
    findTechCompPoint(companyId, level.id, locationId),
  );
}

export function TechEstimatorHero({
  allowInitialPreset,
  scenario,
  assumptions,
  onScenarioChange,
  onAssumptionsChange,
}: TechEstimatorHeroProps) {
  const initialized = useRef(false);
  const previewTrigger = useRef<HTMLButtonElement>(null);
  // Ownership is deliberately session-only. On reload, saved values have no
  // trustworthy provenance and are therefore preserved until explicitly applied.
  const baseline = useRef<{
    scenario: ScenarioV2;
    assumptions: AssumptionsV2;
    owned: Set<string>;
  } | null>(null);
  const [preview, setPreview] = useState<{
    scenario: ScenarioV2;
    assumptions: AssumptionsV2;
  } | null>(null);
  // Check if an actual tech preset is already applied (legacy default "Columbus offer" has company: "Meta" from model.ts)
  const isPresetApplied =
    scenario.name !== "Columbus offer" &&
    techCompanies.some(
      (c) =>
        scenario.role?.toLowerCase().includes(c.name.toLowerCase()) ||
        scenario.name?.toLowerCase().includes(c.name.toLowerCase()) ||
        scenario.issuers?.some((i) =>
          i.name.toLowerCase().includes(c.name.toLowerCase()),
        ),
    );

  const initialCompany = isPresetApplied
    ? techCompanies.find(
        (c) =>
          scenario.role?.toLowerCase().includes(c.name.toLowerCase()) ||
          scenario.name?.toLowerCase().includes(c.name.toLowerCase()) ||
          scenario.company?.toLowerCase() === c.name.toLowerCase() ||
          scenario.issuers?.some((i) =>
            i.name.toLowerCase().includes(c.name.toLowerCase()),
          ),
      )?.id
    : undefined;

  const [selectedCompanyId, setSelectedCompanyId] = useState<string>(
    initialCompany || quickOffer.initial.companyId,
  );
  const [selectedLevelId, setSelectedLevelId] = useState<string>(() => {
    const compId = initialCompany || quickOffer.initial.companyId;
    const levels = availableLevels(compId, scenario.taxProfile.location);
    const matched = levels.find(
      (l) =>
        scenario.name?.toLowerCase().includes(l.level.toLowerCase()) ||
        scenario.role?.toLowerCase().includes(l.title.toLowerCase()),
    );
    return matched?.id ?? (initialCompany ? levels[2]?.id : quickOffer.initial.levelId)
      ?? levels[0]?.id ?? quickOffer.initial.levelId;
  });

  useEffect(() => {
    if (!initialized.current) {
      if (allowInitialPreset && !initialCompany) {
        applyTechPreset(
          quickOffer.initial.companyId,
          quickOffer.initial.levelId,
          quickOffer.initial.locationId as TaxLocation,
          scenario.taxProfile.filing,
          activeGrowthId,
          true,
          true,
        );
      } else {
        getBaseline();
      }
      initialized.current = true;
    }
  }, []);

  function getBaseline(): {
    scenario: ScenarioV2;
    assumptions: AssumptionsV2;
    owned: Set<string>;
  } {
    if (baseline.current) return baseline.current;

    const compId = selectedCompanyId || "google";
    const levelId = selectedLevelId || "l5";
    const locId = scenario.taxProfile.location;
    const comp = findTechCompPoint(compId, levelId, locId);
    if (!comp) {
      const result = { scenario, assumptions, owned: new Set<string>() };
      baseline.current = result;
      return result;
    }
    const company =
      techCompanies.find((c) => c.id === compId) || techCompanies[0];
    const levels = techLevels[compId] || techLevels.google;
    const level = levels.find((l) => l.id === levelId) || levels[0];
    const housing = housingPresets[locId];
    const living =
      scenario.taxProfile.filing === "joint" ? housing.family : housing.single;

    const owned = new Set<string>();

    if (scenario.base === String(comp.base)) owned.add("base");
    if (scenario.bonus === String(comp.bonus)) owned.add("bonus");
    const issuer = scenario.issuers[0];
    const grant = scenario.grants[0];
    const vestingTemplate = company.defaultVestingTemplate;
    const unchangedGrant = comp.annualRsu > 0
      ? scenario.grants.length === 1 &&
        grant.presetCompensation === "tech-quick" &&
        grant.name === quickOffer.grantName &&
        grant.issuerId === scenario.employerId &&
        grant.employmentId === "initial" &&
        grant.month === `${assumptions.startYear}-01` &&
        grant.units === "dollars" &&
        grant.value === String(comp.grantTotal ?? comp.annualRsu * 4) &&
        grant.priceMode === "modeled" &&
        grant.treatment === "sell" &&
        !grant.keepOnDeparture &&
        grant.template === vestingTemplate &&
        JSON.stringify(grant.schedule) === JSON.stringify(templateSchedule(vestingTemplate))
      : scenario.grants.length === 0;
    if (unchangedGrant &&
        scenario.stock === String(comp.annualRsu) &&
        scenario.stockMode === "grants" &&
        scenario.includeStock === (comp.annualRsu > 0) &&
        scenario.issuers.length === 1 &&
        issuer.id === scenario.employerId &&
        (issuer.name === company.name || issuer.name === `${company.name} (${company.ticker})`) &&
        issuer.price === quickOffer.sharePrice &&
        growthPresets.some((preset) => issuer.appreciation === String(preset.stockAppreciation)) &&
        issuer.startingShares === "0" &&
        issuer.startingBasis === "0" &&
        scenario.refreshers.length === 0) {
      owned.add("stock");
      owned.add("stockMode");
      owned.add("includeStock");
      owned.add("employerId");
      owned.add("issuers");
      owned.add("grants");
    }
    if (scenario.signOnY1 === String(comp.signOnY1 ?? 0)) owned.add("signOnY1");
    if (scenario.signOnY2 === String(comp.signOnY2 ?? 0)) owned.add("signOnY2");
    if (scenario.company?.toLowerCase() === company.name.toLowerCase())
      owned.add("company");
    if (scenario.name === `${company.name} ${level.level}`) owned.add("name");
    if (scenario.role === `${level.title} at ${company.name}`) owned.add("role");

    if (
      Object.keys(living).every(
        (key) =>
          Number(scenario.expenses[key as keyof typeof living]) ===
          Number(living[key as keyof typeof living]),
      )
    ) {
      owned.add("expenses");
    }

    const expectedMatch = companyEmployerMatch(company);
    if (scenario.employerMatch?.type === expectedMatch.type &&
        scenario.employerMatch.rate === expectedMatch.rate &&
        scenario.employerMatch.payPercent === expectedMatch.payPercent &&
        scenario.employerMatch.cap === expectedMatch.cap &&
        scenario.employerMatch.vestingType === expectedMatch.vestingType &&
        JSON.stringify(scenario.employerMatch.vestingSchedule) === JSON.stringify(expectedMatch.vestingSchedule))
      owned.add("employerMatch");

    // A saved terminal-level preset has no generated events, but switching to
    // a lower level must still be able to generate its promotion timeline.
    if (isPresetApplied) owned.add("events");

    const growth = growthPresets.find((g) => g.id === activeGrowthId);
    if (growth && assumptions.returns === String(growth.returns))
      owned.add("returns");
    if (growth && assumptions.inflation === String(growth.inflation))
      owned.add("inflation");

    const baselineScenario: ScenarioV2 = {
      ...scenario,
      base: String(comp.base),
      bonus: String(comp.bonus),
      stock: String(comp.annualRsu),
      signOnY1: String(comp.signOnY1 ?? 0),
      signOnY2: String(comp.signOnY2 ?? 0),
      company: company.name,
      name: `${company.name} ${level.level}`,
      role: `${level.title} at ${company.name}`,
      expenses: { ...living },
    };

    const initial = {
      scenario: baselineScenario,
      assumptions: { ...assumptions },
      owned,
    };
    baseline.current = initial;
    return initial;
  }

  useEffect(() => setPreview(null), [scenario, assumptions]);

  const selectedLocationId = scenario.taxProfile.location;
  const selectedFiling = scenario.taxProfile.filing;

  const [includeProgression, setIncludeProgression] = useState<boolean>(() => {
    return (
      scenario.events.some((e) => Boolean(e.presetProgression)) ||
      scenario.events.length === 0
    );
  });

  // Find active growth preset
  const activeGrowthId = growthPresetForReturn(Number(assumptions.returns)).id;

  function handleCompanyChange(company: CompanyPreset, trigger: HTMLButtonElement) {
    const { id: companyId, headquartersLocation } = company;
    setSelectedCompanyId(companyId);
    const levels = availableLevels(companyId, headquartersLocation);
    const defaultLevel = levels[2]?.id || levels[0]?.id || "l5";
    setSelectedLevelId(defaultLevel);
    if (!isPresetApplied) previewTrigger.current = trigger;
    applyTechPreset(
      companyId,
      defaultLevel,
      headquartersLocation,
      selectedFiling,
      activeGrowthId,
      includeProgression,
      false,
      !isPresetApplied,
      ["company"],
    );
  }

  function handleLevelChange(levelId: string, trigger: HTMLButtonElement) {
    const companyId = selectedCompanyId || "google";
    setSelectedCompanyId(companyId);
    setSelectedLevelId(levelId);
    if (!isPresetApplied) previewTrigger.current = trigger;
    applyTechPreset(
      companyId,
      levelId,
      selectedLocationId,
      selectedFiling,
      activeGrowthId,
      includeProgression,
      false,
      !isPresetApplied,
    );
  }

  function handleLocationChange(locationId: TaxLocation) {
    const companyId = selectedCompanyId || "google";
    const levelId = selectedLevelId || "l5";
    setSelectedCompanyId(companyId);
    setSelectedLevelId(levelId);
    applyTechPreset(
      companyId,
      levelId,
      locationId,
      selectedFiling,
      activeGrowthId,
      includeProgression,
    );
  }

  function handleFilingChange(filing: "single" | "joint") {
    const companyId = selectedCompanyId || "google";
    const levelId = selectedLevelId || "l5";
    setSelectedCompanyId(companyId);
    setSelectedLevelId(levelId);
    applyTechPreset(
      companyId,
      levelId,
      selectedLocationId,
      filing,
      activeGrowthId,
      includeProgression,
    );
  }

  function handleProgressionToggle(enabled: boolean) {
    setIncludeProgression(enabled);
    if (selectedCompanyId) {
      applyTechPreset(
        selectedCompanyId,
        selectedLevelId || "l5",
        selectedLocationId,
        selectedFiling,
        activeGrowthId,
        enabled,
        false,
        false,
        ["events"],
      );
    }
  }

  function handleGrowthChange(growthId: GrowthPreset["id"]) {
    const growth = growthPresets.find((item) => item.id === growthId);
    if (!growth) return;
    const shared = { ...assumptions, returns: String(growth.returns) };
    if (baseline.current) {
      baseline.current = {
        ...baseline.current,
        assumptions: shared,
        owned: new Set([...baseline.current.owned, "returns"]),
      };
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
    const company =
      techCompanies.find((c) => c.id === companyId) || techCompanies[0];
    const levels = techLevels[companyId] || techLevels.google;
    const level = levels.find((l) => l.id === levelId) || levels[0];
    const comp = findTechCompPoint(companyId, levelId, locationId);
    if (!comp) return;
    const housing = housingPresets[locationId];
    const living = filing === "joint" ? housing.family : housing.single;
    const growth =
      growthPresets.find((g) => g.id === growthId) || growthPresets[0];

    // Setup 4-year grant and issuer for the detailed model
    const issuerId = scenario.employerId || uid();
    const grantId = uid();
    const vestingTemplate = company.defaultVestingTemplate;
    const fourYearGrantValue = comp.grantTotal ?? comp.annualRsu * 4;

    const newIssuer = {
      id: issuerId,
      name: company.name,
      price: quickOffer.sharePrice,
      appreciation: String(growth.stockAppreciation),
      startingShares: "0",
      startingBasis: "0",
    };

    const startYear = assumptions.startYear || "2026";
    const newGrant = {
      id: grantId,
      name: quickOffer.grantName,
      issuerId,
      employmentId: "initial",
      month: `${startYear}-01`,
      units: "dollars" as const,
      value: String(fourYearGrantValue),
      priceMode: "modeled" as const,
      grantPrice: quickOffer.sharePrice,
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
    const retainedIssuerIds = new Set(
      [...events, ...scenario.refreshers].map((item) => item.issuerId),
    );

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
      issuers: [
        newIssuer,
        ...scenario.issuers.filter((issuer) =>
          issuer.id !== issuerId && retainedIssuerIds.has(issuer.id),
        ),
      ],
      grants: comp.annualRsu > 0 ? [newGrant] : [],
      events,
      taxProfile: {
        ...scenario.taxProfile,
        location: locationId,
        filing,
      },
      expenses: { ...living },
      employerMatch: companyEmployerMatch(company),
    };

    const updatedAssumptions = {
      ...assumptions,
      returns: String(growth.returns),
      inflation: String(growth.inflation),
    };
    if (previewOnly) {
      setPreview({
        scenario: updatedScenario,
        assumptions: updatedAssumptions,
      });
      return;
    }
    applyCandidate(updatedScenario, updatedAssumptions, fullApply, forced);
  }

  function applyCandidate(
    candidate: ScenarioV2,
    nextAssumptions: AssumptionsV2,
    fullApply: boolean,
    forced: string[] = [],
  ) {
    const keys = [
      "name",
      "role",
      "company",
      "base",
      "bonus",
      "stock",
      "signOnY1",
      "signOnY2",
      "stockMode",
      "includeStock",
      "employerId",
      "issuers",
      "grants",
      "events",
      "expenses",
      "employerMatch",
    ] as const;
    const old = getBaseline();
    const same = (left: unknown, right: unknown) =>
      JSON.stringify(left) === JSON.stringify(right);
    const owned = new Set<string>();
    const result = { ...scenario };
    for (const key of keys) {
      // Manual career events do not take ownership away from generated promotions.
      const unchanged = key === "events"
        ? same(
            scenario.events.filter((event) => event.presetProgression),
            old.scenario.events.filter((event) => event.presetProgression),
          )
        : same(scenario[key], old.scenario[key]);
      if (
        fullApply ||
        forced.includes(key) ||
        (old.owned.has(key) && unchanged)
      ) {
        // Keep linked stock settings together when the corresponding grants or
        // issuer have been customized, rather than orphaning a user's grant.
        const linkedStock = [
          "stock",
          "stockMode",
          "includeStock",
          "employerId",
          "issuers",
          "grants",
        ].includes(key);
        const stockSafe =
          fullApply ||
          !linkedStock ||
          (
            [
              "stock",
              "stockMode",
              "includeStock",
              "employerId",
              "issuers",
              "grants",
            ] as const
          ).every(
            (field) =>
              old?.owned.has(field) &&
              same(scenario[field], old.scenario[field]),
          );
        if (stockSafe) {
          Object.assign(result, { [key]: candidate[key] });
          owned.add(key);
        }
      }
    }
    // Location and household are explicit controls, not inferred preset edits.
    result.taxProfile = {
      ...scenario.taxProfile,
      location: candidate.taxProfile.location,
      filing: candidate.taxProfile.filing,
    };
    const shared = { ...assumptions };
    for (const key of ["returns", "inflation"] as const) {
      if (
        fullApply ||
        forced.includes(key) ||
        (old?.owned.has(key) && same(assumptions[key], old.assumptions[key]))
      ) {
        shared[key] = nextAssumptions[key];
        owned.add(key);
      }
    }
    baseline.current = { scenario: result, assumptions: shared, owned };
    onScenarioChange(result);
    onAssumptionsChange(shared);
  }

  const currentLevels = availableLevels(selectedCompanyId, selectedLocationId);
  const selectedCompany =
    techCompanies.find((c) => c.id === selectedCompanyId) || techCompanies[0];
  const scope = techCompensationScope(selectedLocationId);
  const selectedLevel = currentLevels.find((level) => level.id === selectedLevelId);
  const sourcePreset = selectedLevel
    ? findCompensationPreset(selectedCompany.name, selectedLevel.stage, scope)
    : undefined;
  const budgetSource = locationPresets.find(
    (item) => item.id === selectedLocationId,
  );
  const selectedLocation =
    taxLocations.find((l) => l.id === selectedLocationId) || taxLocations[0];
  const selectedComp = findTechCompPoint(selectedCompanyId, selectedLevelId, selectedLocationId);

  return (
    <div className="tech-estimator-hero" aria-label="Big Tech Preset Selector">
      <button
        type="button"
        className="secondary small preset-preview-action"
        onClick={(event) => {
          previewTrigger.current = event.currentTarget;
          applyTechPreset(
            selectedCompanyId,
            selectedLevelId,
            selectedLocationId,
            selectedFiling,
            activeGrowthId,
            includeProgression,
            false,
            true,
          );
        }}
      >
        Preview full preset
      </button>
      <div className="hero-selector-grid">
        {/* Company Selector */}
        <div className="hero-control-group">
          <label className="hero-label">Company</label>
          <div
            className="pill-selector"
            role="group"
            aria-label="Big Tech Company"
          >
            {techCompanies.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`pill-btn ${selectedCompanyId === c.id ? "active" : ""}`}
                aria-pressed={selectedCompanyId === c.id}
                onClick={(event) => handleCompanyChange(c, event.currentTarget)}
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
                onClick={(event) => handleLevelChange(lvl.id, event.currentTarget)}
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
            onChange={(e) =>
              handleLocationChange(e.target.value as TaxLocation)
            }
          >
            {taxLocations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.label}
              </option>
            ))}
          </select>
          <p className="hint">{scope} pay benchmark</p>
        </div>

        {/* Filing & Household Status */}
        <div className="hero-control-group">
          <label className="hero-label">Household</label>
          <div
            className="pill-selector"
            role="group"
            aria-label="Household structure"
          >
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
          <div
            className="pill-selector"
            role="group"
            aria-label="Market Outlook"
          >
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
          <label
            className="progression-checkbox-label"
            htmlFor="progression-model-toggle"
          >
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
          <p className="hint">{selectedCompanyId === "microsoft" ? "No automatic Microsoft promotions are modeled because comparable timing data is unavailable." : selectedCompanyId === "amazon" ? "The L4 to L5 promotion is modeled after 24 months, and L5 to L6 after another 60 months. Promotions are assumptions, not guarantees. A modeled promotion can top up pay using scheduled stock vesting." : "Promotion timing is estimated from differences in average experience. Where annualized stock data is available, a modeled promotion tops up projected compensation for the first four years in the role using cash pay and scheduled stock vesting."}</p>
        </div>

        {/* Optimal Retirement Strategy 1-Click Action */}
      </div>
      {selectedComp?.signOnY1 !== undefined && selectedComp.signOnY2 !== undefined && (
        <div className="preset-sign-on hint">
          <p>{selectedComp.usesRoundedInputs ? "Rounded preset inputs" : "Estimated Amazon sign-on"}: year 1 ${selectedComp.signOnY1.toLocaleString("en-US")} and year 2 ${selectedComp.signOnY2.toLocaleString("en-US")}. {selectedComp.usesRoundedInputs ? "These inputs are illustrative; review your own offer." : "The source reports only a four-year average; this illustrative split offsets the first two years’ vesting difference before raises."} Enter your actual amounts in Offer.</p>
          {(Number(scenario.signOnY1) !== selectedComp.signOnY1 || Number(scenario.signOnY2) !== selectedComp.signOnY2) && (
            <button type="button" className="text-button" onClick={() => onScenarioChange({ ...scenario, signOnY1: String(selectedComp.signOnY1), signOnY2: String(selectedComp.signOnY2) })}>
              Apply estimated sign-on bonuses
            </button>
          )}
        </div>
      )}
      <details className="preset-disclaimer">
        <summary>About these estimates</summary>
        <p className="hint">
          Preset changes keep values you have customized. Saved values are kept
          unless you choose to replace them. Market outlook changes the investment
          return only. Choosing a company starts at its U.S. headquarters metro. Pay
          references generally use public Levels.fyi averages for the Bay Area, Greater Seattle,
          or New York City metro when selected, with U.S. averages for other
          locations. The Amazon L4 Seattle preset uses rounded illustrative inputs instead.
          Google first-year stock and combined bonus / sign-on
          figures are excluded from recurring projections. Cost presets use MIT's
          2026 county budgets for one adult or two adults with one worker, with no
          children; the two-adult household is the planner's joint option.
          {sourcePreset && (
            <> <a href={sourcePreset.source} target="_blank" rel="noreferrer">View source data</a>.</>
          )}
          {budgetSource && (
            <> <a href={budgetSource.source} target="_blank" rel="noreferrer">View {budgetSource.scope} cost data</a>.</>
          )}
        </p>
      </details>
      <Dialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) setPreview(null);
        }}
      >
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            const trigger = previewTrigger.current;
            if (!trigger) return;
            const details = trigger.closest("details");
            if (details) details.open = true;
            trigger.focus();
          }}
        >
          {preview && (
            <div
              className="preset-preview"
              role="region"
              aria-label="Full preset preview"
            >
              <DialogHeader>
                <DialogTitle>Replace values with this preset?</DialogTitle>
                <DialogDescription>
                  This replaces the scenario name, pay, bonuses, stock grants
                  and the initial employer (including any starting shares and
                  cost basis), living costs, match, generated promotions, and
                  market assumptions. Employers used by retained career changes
                  or refreshers are kept.
                </DialogDescription>
              </DialogHeader>
              <ul>
                {preview.scenario.taxProfile.location !== selectedLocationId && (
                  <li>
                    Location changes from {selectedLocation.label} to{" "}
                    {taxLocations.find((location) => location.id === preview.scenario.taxProfile.location)?.label}
                  </li>
                )}
                <li>
                  Annual salary: {scenario.base} → {preview.scenario.base}
                </li>
                <li>
                  Annual bonus: {scenario.bonus} → {preview.scenario.bonus}
                </li>
                <li>
                  Annual stock: {scenario.stock} → {preview.scenario.stock}
                </li>
                <li>
                  Sign-on bonuses (years 1 / 2): {scenario.signOnY1} /{" "}
                  {scenario.signOnY2} → {preview.scenario.signOnY1} /{" "}
                  {preview.scenario.signOnY2}
                </li>
                <li>
                  Employer:{" "}
                  {scenario.issuers.map((i) => i.name).join(", ") || "None"} →{" "}
                  {preview.scenario.issuers.map((i) => i.name).join(", ") ||
                    "None"}
                </li>
                <li>
                  Stock grants: {scenario.grants.length} →{" "}
                  {preview.scenario.grants.length} (existing grants will be
                  replaced)
                </li>
                <li>
                  Career events: {scenario.events.length} →{" "}
                  {preview.scenario.events.length} (manual events are retained)
                </li>
                <li>
                  Employer match: {scenario.employerMatch.type} →{" "}
                  {preview.scenario.employerMatch.rate}% up to{" "}
                  {preview.scenario.employerMatch.payPercent}% of pay
                </li>
                <li>
                  Monthly living costs:{" "}
                  {Object.values(scenario.expenses).reduce(
                    (n, v) => n + (Number(v) || 0),
                    0,
                  )}{" "}
                  →{" "}
                  {Object.values(preview.scenario.expenses).reduce(
                    (n, v) => n + (Number(v) || 0),
                    0,
                  )}
                </li>
                <li>
                  Investment return: {assumptions.returns}% →{" "}
                  {preview.assumptions.returns}%
                </li>
                <li>
                  Expense inflation: {assumptions.inflation}% →{" "}
                  {preview.assumptions.inflation}%
                </li>
              </ul>
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreview(null)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => {
                    applyCandidate(preview.scenario, preview.assumptions, true);
                    setPreview(null);
                  }}
                >
                  Apply full preset
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
