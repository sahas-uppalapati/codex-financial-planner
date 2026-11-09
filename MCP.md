# Local MCP adapter

CareerWorth includes an optional local MCP server. It runs on standard input/output; it opens no network port, does not read or write browser storage or files, and has no account connection. The MCP client receives the plan and results and may send them to its model provider according to that client's settings. Do not include financial information unless you are comfortable sharing it with that client.

After `npm ci`, configure your MCP client to launch Node with two absolute arguments: the repository's `node_modules/tsx/dist/cli.mjs` and `mcp/server.ts`. For example, using actual paths on your machine:

```json
{
  "command": "node",
  "args": ["/absolute/path/to/careerworth/node_modules/tsx/dist/cli.mjs", "/absolute/path/to/careerworth/mcp/server.ts"]
}
```

On Windows use absolute Windows paths with JSON-escaped backslashes. Run on Node 22.12+ or Node 24 LTS. The process uses stdout for MCP protocol messages; do not invoke it through a command that writes banners to stdout.

`example_plan` provides a sample backup to edit. Its numbers are illustrative, not user facts. `project_plan` accepts a complete backup as its `backup` string parameter: either one exported from the app or a modified example. It validates and migrates through the same backup and planner checks used by the app, rejects invalid values, and returns the validated inputs, annual results with monthly details, warnings, rule sources and limitations. Scenarios, assumptions and account information must be confirmed by the user. A backup contains private financial information; the server never automatically reads the app's saved plan.

Projections are estimates under the bundled 2026 rules and the user's assumptions, not a complete tax return or financial advice. See README.md, TAX_SOURCES.md and RETIREMENT_ACCOUNTS_HANDOFF.md for coverage and known gaps. The server has no ability to change the app's saved data, send payments, or make trades.
