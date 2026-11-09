import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { expect, it } from "vitest";

it("serves validated projections over local stdio", async () => {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url)), fileURLToPath(new URL("./server.ts", import.meta.url))],
  });
  const client = new Client({ name: "careerworth-test", version: "1.0.0" });
  try {
    await client.connect(transport);
    const tools = await client.listTools();
    expect(tools.tools.map((tool) => tool.name)).toEqual(["example_plan", "project_plan"]);
    const example = await client.callTool({ name: "example_plan", arguments: {} });
    const content = example.content as Array<{ type: string; text: string }>;
    const projection = await client.callTool({ name: "project_plan", arguments: { backup: content[0].text } });
    expect(projection.isError).not.toBe(true);
    const output = projection.content as Array<{ type: string; text: string }>;
    expect(JSON.parse(output[0].text).scenarios).toHaveLength(1);
    const invalid = await client.callTool({ name: "project_plan", arguments: { backup: "{}" } });
    expect(invalid.isError).toBe(true);
  } finally {
    await client.close();
  }
}, 30000);
