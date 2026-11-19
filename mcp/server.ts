import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { examplePlan, optimizeRetirement, projectPlan } from "./planner";

const server = new McpServer({ name: "careerworth", version: "1.0.0" });
server.registerTool("example_plan", {
  description: "Return an illustrative CareerWorth backup template. Replace sample values with user-confirmed inputs before calculating.",
  inputSchema: {},
}, async () => ({ content: [{ type: "text", text: examplePlan() }] }));

server.registerTool("project_plan", {
  description: "Calculate one or two deterministic scenarios from a CareerWorth JSON backup. Values must be confirmed by the user. No network or browser storage access.",
  inputSchema: { backup: z.string().max(5 * 1024 * 1024).describe("Complete JSON backup produced by CareerWorth or example_plan") },
}, async ({ backup }) => {
  try {
    return { content: [{ type: "text", text: JSON.stringify(projectPlan(backup)) }] };
  } catch {
    return { isError: true, content: [{ type: "text", text: "Invalid or unsupported plan. Provide a valid CareerWorth backup with inputs within supported limits." }] };
  }
});

server.registerTool("optimize_retirement", {
  description: "Calculate optimal tax-advantaged retirement waterfall allocation (match -> HSA -> IRA -> 401(k) -> Mega Backdoor) for a plan.",
  inputSchema: {
    backup: z.string().max(5 * 1024 * 1024).describe("Complete JSON backup produced by CareerWorth or example_plan"),
    targetSavings: z.number().optional().describe("Annual target retirement savings in USD"),
    taxPreference: z.enum(["traditional", "roth", "auto", "balanced"]).optional().describe("Tax strategy preference (default auto)"),
  },
}, async ({ backup, targetSavings, taxPreference }) => {
  try {
    return { content: [{ type: "text", text: JSON.stringify(optimizeRetirement(backup, targetSavings, taxPreference)) }] };
  } catch {
    return { isError: true, content: [{ type: "text", text: "Invalid plan or parameters. Provide a valid CareerWorth backup." }] };
  }
});

await server.connect(new StdioServerTransport());
