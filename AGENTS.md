# Repository guidance

## Project

CareerWorth is a private, browser-only career and compensation planner. It uses React 19, TypeScript, Vite, plain CSS, and localStorage. There is no backend or live financial-data service. Keep calculations deterministic and keep user data in the browser.

## Working conventions

- When proposing or building a user-facing feature, compare its usefulness with what a user could get from an LLM in a few prompts with the same information. Identify the concrete advantage or evidence to test (such as reliable calculations, privacy, or easier comparison); do not assume the feature is valuable merely because it exists.
- Read `README.md`, `docs/DATA_SOURCES.md`, and `docs/TAX_SOURCES.md` before changing projection, tax, equity, or compensation behavior.
- Keep calculation logic in the pure modules under `src/lib/` and sourced assumptions in `src/data/`. Keep React components focused on input and presentation.
- Preserve validation and numerical guardrails in `src/lib/planner.ts`; reject non-finite results and invalid drafts rather than silently calculating with them.
- Treat tax and compensation figures as planning estimates. Do not describe modeled tax reserves as payroll withholding or the result as a complete tax return or net worth.
- Do not add network calls, analytics, account creation, API keys, or server-side storage without an explicit product requirement.
- Preserve existing saved-data compatibility and migration behavior. Version storage format changes deliberately and cover old-format handling in the relevant tests.
- Keep CSV exports safe for spreadsheet use: quote text and neutralize formula-like user-entered values.
- Follow existing accessibility patterns: associate labels with controls, preserve keyboard access, and ensure responsive layouts work on narrow screens.
- Keep tests minimal and high-signal: avoid over-engineering tests, multiplying redundant test cases, or writing overly brittle multi-step checks. AI agents tend to over-engineer tests; prefer the smallest lean test that verifies the core requirement.
- Update the README and relevant source documentation when model assumptions, supported locations, limits, or user-facing behavior change.

## Verification

Do **not** run the full test suite or builds (`npm test`, full `npx playwright test`, `npm run build`) during iterative coding, as running all tests slows development down significantly.

- Run **only the specific test file or targeted test case** directly applicable to the code you are editing (e.g. `npx vitest run src/lib/tax.test.ts` or `npx playwright test -g "specific test"`).
- Avoid proliferating new tests: minimize the number of tests in the repository and consolidate checks instead of adding repetitive assertions.
- Verify broader checks (`npm test`, `npm run build`) only when implementation is complete, when explicitly requested, or before preparing a PR commit. If a check or other task is likely to take a while, either start it in the background and continue independent work or defer it; do not block iteration waiting for it.

When verification is requested:
Run from the repository root with Node.js 22.12+ or Node 24 LTS:

```bash
npm test
npm run build
```

On WSL, use the Linux Node/npm installation from `nvm` (`nvm use 24`). Before running checks, confirm `command -v node` and `command -v npm` resolve under `$HOME/.nvm/versions/node/.../bin`, not to Windows executables under `/mnt/c`. Codex may run noninteractive shells, so keep `nvm` initialization above `.bashrc`'s noninteractive-shell guard.

For a focused change, run the relevant test file first, then the broader checks above when practical. Do not commit generated `dist/`, `test-results/`, or local dependency directories.

## Important project references

- `README.md`: operating instructions, model semantics, limitations, and code map.
- `docs/TAX_SOURCES.md` and `src/data/taxRules.ts`: tax source notes, version, and access dates.
- `docs/DATA_SOURCES.md`: compensation and budget provenance.
- `docs/RETIREMENT_ACCOUNTS_PLAN.md`: retirement-account model scope and design.
- `src/lib/*`: calculations, validation, storage, migration, and CSV generation.
- `src/data/*`: sourced tax and vesting assumptions.
