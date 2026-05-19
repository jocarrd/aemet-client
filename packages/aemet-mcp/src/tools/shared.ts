import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";

export type ToolResult = CallToolResult;

export function errorContent(message: string): ToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: message }],
  };
}

export function textContent(text: string): ToolResult {
  return {
    content: [{ type: "text", text }],
  };
}
