import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ResolutionError } from "../resolve.js";

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

export function resolutionErrorContent(err: ResolutionError): ToolResult {
  const message = err.message.endsWith(".") ? err.message : `${err.message}.`;
  return errorContent(err.hint ? `${message} ${err.hint}` : message);
}
