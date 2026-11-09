import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { examplePlan, projectPlan } from "./planner";

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

await server.connect(new StdioServerTransport());
