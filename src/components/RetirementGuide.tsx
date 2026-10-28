const accounts = [
  ["Traditional 401(k)", "Modeled here", "Workplace contributions generally reduce current income tax; withdrawals are generally taxable. Plan rules and investment options vary.", "https://www.irs.gov/newsroom/401k-limit-increases-to-24500-for-2026-ira-limit-increases-to-7500"],
  ["Roth 401(k)", "Learn about this account", "Contributions are taxed today and qualified withdrawals can be tax-free. Roth and traditional deferrals share the employee limit.", "https://www.irs.gov/retirement-plans/retirement-plans-faqs-on-designated-roth-accounts"],
  ["Traditional IRA", "Learn about this account", "Deductibility depends on income and workplace-plan coverage. Keep basis records for nondeductible contributions.", "https://www.irs.gov/publications/p590a"],
  ["Roth IRA", "Learn about this account", "Qualified withdrawals can be tax-free. Direct contributions have income restrictions.", "https://www.irs.gov/publications/p590a"],
  ["Backdoor Roth IRA", "Learn about this strategy", "A nondeductible IRA contribution followed by a conversion. Existing traditional, rollover, SEP, or SIMPLE IRA balances can make a conversion partly taxable; this strategy does not add another IRA limit.", "https://www.irs.gov/instructions/i8606"],
  ["Mega backdoor Roth", "Learn about this strategy", "Some workplace plans allow after-tax contributions above regular deferrals and a conversion or rollover to Roth. Plan features and annual additions limits apply.", "https://www.irs.gov/retirement-plans/rollovers-of-after-tax-contributions-in-retirement-plans"],
  ["403(b), governmental 457(b), and TSP", "Learn about these accounts", "Workplace options for eligible nonprofit, public-sector, and federal employees. Nongovernmental 457(b) plans have different rules and risks.", "https://www.investor.gov/introduction-investing/investing-basics/investment-accounts/tax-advantaged-accounts/retirement-savings/403b-and-457b-plans"],
  ["Solo 401(k), SEP IRA, and SIMPLE IRA", "Learn about these accounts", "Plans for eligible self-employed workers, business owners, and small-business employees. Eligibility and contribution rules differ by plan.", "https://www.irs.gov/retirement-plans/plan-sponsor/types-of-retirement-plans"],
  ["Pensions and cash-balance plans", "Learn about these plans", "Employer benefits are determined by plan formulas; review the plan document and benefit estimate.", "https://www.irs.gov/retirement-plans/plan-sponsor/types-of-retirement-plans"],
  ["Health savings account (HSA)", "Modeled here", "An HSA can complement retirement saving, but eligibility and qualified medical-expense rules apply.", "https://www.irs.gov/publications/p969"],
  ["Taxable brokerage", "Modeled here", "Flexible investing outside retirement accounts, without retirement contribution limits or the same tax advantages.", "https://www.investor.gov/introduction-investing/investing-basics/investment-accounts"],
];

export function RetirementGuide() {
  return (
    <section className="cash-panel prose" aria-labelledby="retirement-guide-heading">
      <div className="panel-heading">
        <h2 id="retirement-guide-heading">Which retirement accounts can I use?</h2>
      </div>
      <p className="hint">A brief orientation, not individualized tax or investment advice. Contribution limits and eligibility rules depend on the tax year and your circumstances. Sources checked October 27, 2026.</p>
      <div className="guide-list">
        {accounts.map(([name, status, description, url]) => (
          <article key={name}>
            <h3>{name} <span className="status-tag">{status}</span></h3>
            <p>{description}</p>
            <a href={url} target="_blank" rel="noreferrer">Official source ↗</a>
          </article>
        ))}
      </div>
    </section>
  );
}
