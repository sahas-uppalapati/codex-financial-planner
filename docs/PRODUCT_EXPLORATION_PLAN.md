# CareerWorth product exploration plan

Status: the Capitalio-inspired planner UI refactor is implemented. The product hypotheses and future experiments below remain unvalidated; appearance is not evidence of demand or improved usability.

## Vision and starting point

CareerWorth should help someone understand what their financial future could look like at a company they are considering joining. Begin with a useful estimate from a few inputs; make deeper assumptions and planning optional. The longer-term possibility is a free, richer financial planner, but the initial audience, feature set, and business model remain open.

The founder's immediate use case is evaluating a real offer. Startup offers are a particularly promising entry point: candidates may not understand their equity, know which information is missing, or know what to ask. CareerWorth can combine education, offer evaluation, and projections around that decision.

Existing resources already address parts of this problem, including [Carta's equity calculator](https://carta.com/sg/en/learn/equity/startup-equity-calculator/), [Holloway's candidate questions](https://www.holloway.com/g/equity-compensation/sections/questions-candidates-can-ask), and [Equity Decoder](https://www.equitydecoder.com/calculator). The hypothesis to test is whether CareerWorth can make the end-to-end decision easier, especially when offer details are incomplete. Competition and user demand require further research.

## What exists today

The README describes a quick estimate, detailed scenario comparison, compensation and equity projections, local storage, JSON backup and restore, and an optional local agent interface. It also documents optional, opt-in analytics. Review the current implementation before proposing changes; do not assume features discussed as future possibilities are absent. In particular, the existing public-stock/RSU model must not be presented as a validated startup-option or private-company exit model.

Candidate questions are a starting point for research, not verified financial guidance or a requirement to model every item.

## Experiments

Explore these independently or as connected screens, reusing existing functionality where appropriate:

1. **Startup offer decoder:** accept incomplete information; summarize known terms, identify unknowns, explain why they matter, and generate a copyable list of questions for the recruiter or founder.
2. **Financial future:** show a clear multi-year estimate for a company, with easy adjustment of pay, spending, savings, and other assumptions. Keep speculative private equity separate from cash and current assets.
3. **Offer comparison:** compare a startup, another offer, or a current role across cash, benefits, equity uncertainty, and user-selected nonfinancial considerations.

Use fictional amounts first. Record time to a useful result, missing information, confusing terms, and what affects the decision. Then observe a small number of people who have recently evaluated startup offers. Ask them to complete a realistic task and describe what they would do next. Compare with existing tools and an AI assistant; avoid treating a positive reaction alone as evidence of demand.

## First proposed slice: offer decoder

Direction update: the founder's main decision is comparing a startup offer with Big Tech. The experiment now belongs in the existing planner's comparison flow, with optional startup inputs and hypothetical outcomes and break-even analysis. Keep private equity proceeds separate from projected cash and assets; contextual questions are secondary. Compare its usefulness with an LLM given the same offer information.

- Provide a separate, accessible entry point without removing or replacing the existing calculator.
- Accept optional known terms such as salary, bonus, equity type, grant size, vesting, strike price, fully diluted share count or ownership, and exercise window. Distinguish unknown from zero and ask only relevant follow-up questions.
- Show known facts, missing details, short explanations, and a copyable recruiter question list. Treat uncertain or verbal promises separately from confirmed written terms.
- Do not infer private equity value from share count alone or treat last-round valuation as employee proceeds. Ownership, dilution, exercise costs, liquidation preferences, taxes, liquidity and grant terms can materially change outcomes. Any future model needs explicit assumptions, sourced documentation, and validation; do not present hypothetical outcomes as forecasts or guaranteed compensation.
- Use concise, sourced educational material in context. Consider standalone guides only after observing demand.

Before implementation, inspect the app and propose exact inputs, outputs, and a fictional example for review. Define the smallest useful scope based on existing code and the founder's experience. Implementation can then be evaluated using the repository's focused verification rules.

## Interface direction

[Capitalio](https://ui.watermelon.sh/dashboard/capitalio-dashboard) is the visual reference for the implemented results dashboard. ProjectionLab is a reference for a guided, step-by-step setup and scenario exploration. These are inspiration, not a commitment to copy branding, import a full template, or reproduce every feature; check applicable licenses before reusing code or assets.

Capitalio's [shadcn registry definition](https://registry.watermelon.sh/r/capitalio-dashboard.json) can be inspected directly. Its install command is `npx shadcn@latest add https://registry.watermelon.sh/r/capitalio-dashboard.json`; do not run it without deciding to adopt the block and reviewing its dependencies and license.

Keep initial entry lightweight: show a useful result with essential inputs, then progressively disclose additional details. Explore a dashboard treatment only where it helps users understand and compare results. Assess desktop, narrow screens, keyboard use, and readable assumptions. The actual live dashboard and its registry were inspected on November 16, 2026, including desktop light/dark and mobile rendering. The implementation uses the reference’s self-hosted Inter typography, neutral surfaces, fine borders, compact controls, blue actions, dark icon badges, and restrained chart accents. Actions use a slightly darker blue and dark-mode borders are more visible for accessibility. The full block and its assets were not copied.

## AI and architecture

People may prefer asking an agent about an offer rather than filling out a website. Test this with fictional scenarios and potential users before adding a new AI product or integration. The agent can gather and explain information while deterministic, validated application code performs calculations; results should include inputs, assumptions, missing information, and limitations.

The repository already documents an optional local interface in [MCP.md](MCP.md); inspect and evaluate it before proposing a new MCP server. Browser-only storage does not make data submitted to a hosted AI provider private. Any new remote integration, network call, account, or server-side storage needs an explicit product requirement and privacy design.

The implemented interface retains React, TypeScript, Vite, and Vercel. Tailwind runs through the Vite plugin, with the used shadcn/ui Button, Card, Input, and Dialog primitives. Shared CSS theme tokens replace the former stylesheet and its successive overrides. Preserve existing local data and compatibility; revisit storage or dependencies only when a validated feature requires them.

## Decision gates

- **After personal trial:** Does the decoder answer the founder's real questions and make missing information actionable?
- **After user trials:** Can prospective users understand their next step, and do they find it more useful than existing options? Record specific evidence and friction rather than inventing success metrics in retrospect.
- **After the first implementation:** Verify the relevant behavior, accessibility, privacy, and financial-language boundaries. Decide whether to refine the decoder, pursue projections/comparison, or stop the experiment.
- **Later:** Consider guided setup, a richer dashboard, broader educational content, and additional agent integration only when user needs justify them.

## Implemented planner interface

At 1200px and above, a compact results rail sits beside a 340px input panel and flexible results workspace. Below 1200px, labeled navigation sits above stacked inputs and results. The page scrolls normally, and tables scroll horizontally inside their containers. Mobile navigation scrolls to the selected results; **View results** and **Edit inputs** provide direct jumps.

The input panel begins with scenario selection and **Add comparison**. Salary, annual stock, living costs, invested savings, and the horizon remain visible. Bonus and salary growth belong to **Offer**; optional company presets stay compact and collapsed. Advanced sections are **Living costs**, **Retirement & benefits** (including employer-match presets and all quick savings strategies), **Taxes**, **Equity**, **Career changes**, and **Starting balances & assumptions**. Opening a section reveals its editor directly, without a second wrapper disclosure; individual grants and optional details remain expandable. Error markers expose invalid drafts inside closed sections.

A single navigation system offers **Overview**, **Cash Flow**, **Taxes**, and **Annual Schedule**, with one inspected calendar year retained across navigation and temporary invalid drafts. Overview contains monthly metrics, the existing SVG portfolio chart, ending accounts, comparison insights, and separately labeled hypothetical startup outcomes. Detailed cash-flow, tax, and annual tables live in their corresponding destinations. Annual and monthly CSV exports share one toolbar. Theme-aware dialogs preserve full-preset and validated-backup confirmation semantics; backup/restore, sharing, reset, guidance, model explanations, and analytics consent remain accessible.

Appearance defaults to **System**, responds to system changes, and can be set to **Light** or **Dark**. The preference is separate from planner data and degrades to in-memory behavior without storage. Financial types, pure calculations, planner storage schemas, migration logic, CSV formats, and shared-link formats are unchanged. No backend, new analytics, or data service was added. Fonts are bundled locally. The shadcn MIT notice is preserved. Print has a light layout with fewer annual-table detail columns.

## Verification and remaining product questions

The intended advantage over a chat with the same information is immediate deterministic comparison with visible assumptions. This implementation does not establish that advantage through appearance alone.

The focused pre-refactor browser baseline covered manual edits, preset edit ownership and full-replacement confirmation, scenario comparison, real CSV downloads, invalid drafts, sharing, and theme/navigation behavior. Existing coverage was adapted to the new destinations, and a previously skipped budget/tax-independence check was restored. The consolidated theme/navigation test checks inspected-year retention, invalid drafts, separate planner/theme storage, reload, and live system appearance changes. Existing responsive and axe checks were extended to both themes and expanded editors, comparisons, startup mode, result tables, and a dialog.

Rendered reference comparisons cover desktop and mobile in both themes. The layout inspection checks 320, 390, 768, 1024, and 1440px; expanded editors, long names, startup mode, and all result destinations remain within the page width. Numerical examples remain asserted by the existing financial and browser tests. Verification on November 16, 2026: Linux Node 24.22.2; `npm test` passed all 249 tests across 14 files; `npm run build` passed; all 50 desktop/mobile Playwright checks passed, including the extended axe checks. An additional 50-case rendered sweep across the five widths, both themes, and normal/expanded comparison/startup/result views reported no page overflow or browser exceptions. Dark appearance prints with light surfaces. Automated accessibility checks are not a claim of full WCAG conformance. The production build reports a 536 kB minified JavaScript chunk (160 kB gzip), above Vite’s default advisory threshold; it does not fail the build. No deployment was performed.

Manual walkthrough tasks: replace salary and living costs, locate investment return under **Starting balances & assumptions**, and add/edit a comparison. Remaining friction to validate with people:

- On mobile, the stacked input panel is long. Jump links reduce navigation distance, but inputs and outputs cannot be seen together.
- Retirement, equity, and career editors contain specialized terms and many controls. Progressive disclosure does not establish that a new user understands them.
- Long scenario names wrap in results and truncate in compact scenario controls. Confirm that people can still distinguish their offers.
- Monthly remaining cash includes net proceeds of stock sold; the note and detailed cash-flow destination explain this, but people may initially assume it is paycheck-only cash.

Observe users performing these tasks and compare with an LLM given identical inputs before claiming a usability improvement.
