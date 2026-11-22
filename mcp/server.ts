import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { backupFitsSizeLimit } from "../src/lib/plannerBackup";
import { examplePlan, optimizeRetirement, projectPlan } from "./planner";

const backupInput = z.string()
  .refine(backupFitsSizeLimit, "Backup is too large.")
  .describe("Complete JSON backup produced by CareerWorth or example_plan");

const server = new McpServer({ name: "careerworth", version: "1.0.0" });
server.registerTool("example_plan", {
  description: "Return an illustrative CareerWorth backup template. Replace sample values with user-confirmed inputs before calculating.",
  inputSchema: {},
}, async () => ({ content: [{ type: "text", text: examplePlan() }] }));

server.registerTool("project_plan", {
  description: "Calculate one or two deterministic scenarios from a CareerWorth JSON backup. Values must be confirmed by the user. No network or browser storage access.",
  inputSchema: { backup: backupInput },
}, async ({ backup }) => {
  try {
    return { content: [{ type: "text", text: JSON.stringify(projectPlan(backup)) }] };
  } catch {
    return { isError: true, content: [{ type: "text", text: "Invalid or unsupported plan. Provide a valid CareerWorth backup with inputs within supported limits." }] };
  }
});

server.registerTool("optimize_retirement", {
  description: "Estimate a retirement savings allocation for the primary worker in the first scenario in a CareerWorth backup. Backdoor Roth and mega backdoor Roth allocations require the confirmations saved in that scenario.",
  inputSchema: {
    backup: backupInput,
    targetSavings: z.number().nonnegative().optional().describe("Annual target retirement savings in USD (default 30000)"),
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
