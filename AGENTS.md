# Repository guidance

## Project

CareerWorth is a private, browser-only career and compensation planner. It uses React 19, TypeScript, Vite, plain CSS, and localStorage. There is no backend or live financial-data service. Keep calculations deterministic and keep user data in the browser.

## Working conventions

- Read `README.md`, `DATA_SOURCES.md`, and `TAX_SOURCES.md` before changing projection, tax, equity, or compensation behavior.
- Keep calculation logic in the pure modules under `src/lib/` and sourced assumptions in `src/data/`. Keep React components focused on input and presentation.
- Preserve validation and numerical guardrails in `src/lib/planner.ts`; reject non-finite results and invalid drafts rather than silently calculating with them.
- Treat tax and compensation figures as planning estimates. Do not describe modeled tax reserves as payroll withholding or the result as a complete tax return or net worth.
- Do not add network calls, analytics, account creation, API keys, or server-side storage without an explicit product requirement.
- Preserve existing saved-data compatibility and migration behavior. Version storage format changes deliberately and cover old-format handling in the relevant tests.
- Keep CSV exports safe for spreadsheet use: quote text and neutralize formula-like user-entered values.
- Follow existing accessibility patterns: associate labels with controls, preserve keyboard access, and ensure responsive layouts work on narrow screens.
- Update the README and relevant source documentation when model assumptions, supported locations, limits, or user-facing behavior change.

## Verification

Run from the repository root with Node.js 22.12+ or Node 24 LTS:

```bash
npm test
npm run build
npm run test:e2e
```

On WSL, use the Linux Node/npm installation from `nvm` (`nvm use 24`). Before running checks, confirm `command -v node` and `command -v npm` resolve under `$HOME/.nvm/versions/node/.../bin`, not to Windows executables under `/mnt/c`. Codex may run noninteractive shells, so keep `nvm` initialization above `.bashrc`'s noninteractive-shell guard.

For a focused change, run the relevant test file first, then the broader checks above when practical. Browser tests require Playwright Chromium; see `README.md` for setup and the WSL-specific invocation. Do not commit generated `dist/`, `test-results/`, or local dependency directories.

## Important project references

- `README.md`: operating instructions, model semantics, limitations, and code map.
- `TAX_SOURCES.md` and `src/data/taxRules.ts`: tax source notes, version, and access dates.
- `DATA_SOURCES.md`: compensation and budget provenance.
- `RETIREMENT_ACCOUNTS_PLAN.md`: retirement-account model scope and design.
- `src/lib/*`: calculations, validation, storage, migration, and CSV generation.
- `src/data/*`: sourced tax and vesting assumptions.
