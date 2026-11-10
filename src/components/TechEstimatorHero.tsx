import { useEffect, useState } from "react";
import type { Grant, ScenarioV2 } from "../lib/planner";
import {
  techCompanies,
  techLevels,
  findTechCompPoint,
  employerMatchForCompany,
} from "../data/techCompPresets";
import { templateSchedule } from "../data/vesting";
import { uid } from "../lib/planner";

interface TechEstimatorHeroProps {
  scenario: ScenarioV2;
  startYear: string;
  onScenarioChange: (scenario: ScenarioV2) => void;
}

export function preserveUserGrants(grants: Grant[]): Grant[] {
  return grants.filter((grant) => !grant.presetCompensation);
}

export function presetCompanyFor(scenario: ScenarioV2) {
  if (scenario.name === "Columbus offer") return undefined;
  return techCompanies.find((company) => {
    const name = company.name.toLowerCase();
    return scenario.role?.toLowerCase().includes(name) ||
      scenario.name?.toLowerCase().startsWith(name) ||
      scenario.issuers?.some((issuer) => issuer.name.toLowerCase().includes(name));
  });
}

function entryLevel(companyId: string) {
  const levels = techLevels[companyId] ?? [];
  return levels.find((level) => level.stage === "entry") ?? levels[0];
}

export function TechEstimatorHero({ scenario, startYear, onScenarioChange }: TechEstimatorHeroProps) {
  const activeCompany = presetCompanyFor(scenario);
  const [selectedCompanyId, setSelectedCompanyId] = useState(activeCompany?.id ?? "");
  const [selectedLevelId, setSelectedLevelId] = useState(() => {
    const levels = activeCompany ? techLevels[activeCompany.id] ?? [] : [];
    return levels.find((level) => scenario.name.includes(level.level))?.id ??
      entryLevel(activeCompany?.id ?? "")?.id ?? "";
  });

  useEffect(() => {
    const company = presetCompanyFor(scenario);
    setSelectedCompanyId(company?.id ?? "");
    const levels = company ? techLevels[company.id] ?? [] : [];
    setSelectedLevelId(
      levels.find((level) => scenario.name.includes(level.level))?.id ??
        entryLevel(company?.id ?? "")?.id ?? "",
    );
  }, [scenario.name, scenario.role, scenario.issuers]);

  function applyPreset(companyId: string, levelId: string) {
    const company = techCompanies.find((item) => item.id === companyId);
    const level = (techLevels[companyId] ?? []).find((item) => item.id === levelId);
    if (!company || !level) return;
    const compensation = findTechCompPoint(companyId, levelId, scenario.taxProfile.location);
    const issuerId = uid();
    const issuerName = `${company.name} (${company.ticker})`;
    const existingIssuer = scenario.issuers.find((item) => item.name === issuerName);
    const finalIssuerId = existingIssuer?.id ?? issuerId;
    const generatedGrant = compensation.annualRsu > 0
      ? {
          id: uid(),
          name: "Initial 4-Year New Hire Grant",
          issuerId: finalIssuerId,
          employmentId: "initial",
          month: `${startYear}-01`,
          units: "dollars" as const,
          value: String(compensation.grantTotal ?? compensation.annualRsu * 4),
          priceMode: "modeled" as const,
          grantPrice: "150",
          schedule: templateSchedule(company.defaultVestingTemplate),
          template: company.defaultVestingTemplate,
          treatment: "sell" as const,
          keepOnDeparture: false,
          presetCompensation: company.id,
        }
      : undefined;
    const issuer = existingIssuer ?? {
      id: issuerId,
      name: issuerName,
      price: "150",
      appreciation: "0",
      startingShares: "0",
      startingBasis: "0",
    };
    const employerMatch = employerMatchForCompany(company);
    const preservedGrants = preserveUserGrants(scenario.grants);
    onScenarioChange({
      ...scenario,
      employerId: finalIssuerId,
      name: `${company.name} ${level.level}`,
      role: `${level.title} at ${company.name}`,
      company: company.name,
      base: String(compensation.base),
      bonus: String(compensation.bonus),
      stock: String(compensation.annualRsu),
      signOnY1: String(compensation.signOnY1 ?? 0),
      signOnY2: String(compensation.signOnY2 ?? 0),
      stockMode: "grants",
      includeStock: compensation.annualRsu > 0,
      issuers: existingIssuer ? scenario.issuers : [...scenario.issuers, issuer],
      grants: generatedGrant ? [...preservedGrants, generatedGrant] : preservedGrants,
      employerMatch,
    });
  }

  const currentLevels = selectedCompanyId ? techLevels[selectedCompanyId] ?? [] : [];
  const selectedCompany = techCompanies.find((company) => company.id === selectedCompanyId);

  return (
    <details className="tech-estimator-hero">
      <summary>Use a tech company offer estimate <span className="optional">Optional shortcuts</span></summary>
      <div className="hero-selector-grid">
        <div className="hero-control-group">
          <span className="hero-label">Company</span>
          <div className="pill-selector" role="group" aria-label="Tech company estimate">
            {techCompanies.map((company) => (
              <button
                key={company.id}
                type="button"
                className={`pill-btn ${selectedCompanyId === company.id ? "active" : ""}`}
                aria-pressed={selectedCompanyId === company.id}
                onClick={() => {
                  const level = entryLevel(company.id);
                  if (!level) return;
                  setSelectedCompanyId(company.id);
                  setSelectedLevelId(level.id);
                  applyPreset(company.id, level.id);
                }}
              >
                {company.name}
              </button>
            ))}
          </div>
        </div>
        {selectedCompany && (
          <>
            <div className="hero-control-group">
              <span className="hero-label">Level estimate</span>
              <div className="pill-selector" role="group" aria-label="Tech role level">
                {currentLevels.map((level) => (
                  <button
                    key={level.id}
                    type="button"
                    className={`pill-btn ${selectedLevelId === level.id ? "active" : ""}`}
                    aria-pressed={selectedLevelId === level.id}
                    title={level.title}
                    onClick={() => {
                      setSelectedLevelId(level.id);
                      applyPreset(selectedCompany.id, level.id);
                    }}
                  >
                    {level.level}
                  </button>
                ))}
              </div>
            </div>
            <p className="hint">
              Uses the selected location and published compensation snapshot to fill editable salary, bonus, and equity inputs. Your budget and other assumptions stay as entered. Estimates are not guaranteed offers.
            </p>
          </>
        )}
        <p className="hint">
          Compensation preset values are sourced snapshots. <a href="https://www.levels.fyi/" target="_blank" rel="noreferrer">View Levels.fyi</a> and the project’s preset source notes.
        </p>
      </div>
    </details>
  );
}
