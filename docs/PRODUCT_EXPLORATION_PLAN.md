# CareerWorth product exploration plan

Status: working direction, not an approved feature specification. This records the product discussion and identifies experiments to validate before committing to a broader redesign.

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

[Capitalio](https://ui.watermelon.sh/dashboard/capitalio-dashboard) is the preferred visual reference for a future results dashboard. ProjectionLab is a reference for a guided, step-by-step setup and scenario exploration. These are inspiration, not a commitment to copy branding, import a full template, or reproduce every feature; check applicable licenses before reusing code or assets.

Capitalio's [shadcn registry definition](https://registry.watermelon.sh/r/capitalio-dashboard.json) can be inspected directly. Its install command is `npx shadcn@latest add https://registry.watermelon.sh/r/capitalio-dashboard.json`; do not run it without deciding to adopt the block and reviewing its dependencies and license.

Keep initial entry lightweight: show a useful result with essential inputs, then progressively disclose additional details. Explore a dashboard treatment only where it helps users understand and compare results. Assess desktop, narrow screens, keyboard use, and readable assumptions. The screenshots shared in the discussion were unavailable, so their details have not been verified.

## AI and architecture

People may prefer asking an agent about an offer rather than filling out a website. Test this with fictional scenarios and potential users before adding a new AI product or integration. The agent can gather and explain information while deterministic, validated application code performs calculations; results should include inputs, assumptions, missing information, and limitations.

The repository already documents an optional local interface in [MCP.md](MCP.md); inspect and evaluate it before proposing a new MCP server. Browser-only storage does not make data submitted to a hosted AI provider private. Any new remote integration, network call, account, or server-side storage needs an explicit product requirement and privacy design.

React, TypeScript, Vite, plain CSS, and Vercel can support the proposed interface. No framework or styling-system migration is required to test these ideas. Preserve existing local data and compatibility; revisit storage or dependencies only when a validated feature requires them.

## Decision gates

- **After personal trial:** Does the decoder answer the founder's real questions and make missing information actionable?
- **After user trials:** Can prospective users understand their next step, and do they find it more useful than existing options? Record specific evidence and friction rather than inventing success metrics in retrospect.
- **After the first implementation:** Verify the relevant behavior, accessibility, privacy, and financial-language boundaries. Decide whether to refine the decoder, pursue projections/comparison, or stop the experiment.
- **Later:** Consider guided setup, a richer dashboard, broader educational content, and additional agent integration only when user needs justify them.
