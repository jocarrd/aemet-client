import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { AemetClient, CapDocument, CapInfo, CapSeverity } from "aemet-client";
import { ResolutionError, resolveCapArea } from "../resolve.js";
import { errorContent } from "./shared.js";

const inputSchema = {
  area: z
    .string()
    .min(1)
    .describe(
      "Spanish autonomous community: name ('Cataluña', 'Madrid', 'La Rioja'), 2-digit AEMET code (61-78), or 'esp' for national.",
    ),
  language: z
    .enum(["es", "en", "ca", "gl", "eu", "any"])
    .optional()
    .describe("Preferred warning language (default 'es'). 'any' returns the first available."),
  minSeverity: z
    .enum(["Minor", "Moderate", "Severe", "Extreme"])
    .optional()
    .describe("Only return warnings at or above this severity."),
};

const SEVERITY_RANK: Record<CapSeverity, number> = {
  Unknown: 0,
  Minor: 1,
  Moderate: 2,
  Severe: 3,
  Extreme: 4,
};

export function registerWarningsTool(server: McpServer, client: AemetClient): void {
  server.registerTool(
    "get_warnings",
    {
      title: "Active CAP weather warnings for a Spanish region",
      description:
        "Returns the most recent CAP (Common Alerting Protocol) weather warnings issued by AEMET for the given autonomous community, or for the whole country ('esp'). Severity follows the CAP standard: Minor, Moderate, Severe, Extreme.",
      inputSchema,
    },
    async (args) => {
      const { area, language = "es", minSeverity } = args;
      try {
        const resolved = resolveCapArea(area);
        const docs = await client.warnings.latest(resolved.code);
        if (docs.length === 0) {
          return {
            content: [
              {
                type: "text",
                text: `No active warnings for ${resolved.key === "esp" ? "Spain" : resolved.key} right now.`,
              },
            ],
          };
        }
        return {
          content: [
            {
              type: "text",
              text: formatWarnings(docs, resolved.key, language, minSeverity),
            },
          ],
        };
      } catch (err) {
        if (err instanceof ResolutionError) {
          return errorContent(err.message + (err.hint ? ` ${err.hint}` : ""));
        }
        throw err;
      }
    },
  );
}

function pickInfo(
  infos: CapInfo[],
  language: string,
): CapInfo | undefined {
  if (language === "any") return infos[0];
  const tag = `${language}-`;
  return infos.find((i) => i.language.toLowerCase().startsWith(tag)) ?? infos[0];
}

function formatWarnings(
  docs: CapDocument[],
  areaKey: string,
  language: string,
  minSeverity: CapSeverity | undefined,
): string {
  const threshold = minSeverity ? SEVERITY_RANK[minSeverity] : 0;
  const rows: string[] = [];
  let kept = 0;

  for (const doc of docs) {
    const info = pickInfo(doc.alert.info, language);
    if (!info) continue;
    if (SEVERITY_RANK[info.severity] < threshold) continue;
    kept++;
    rows.push(`[${info.severity}] ${info.event}`);
    rows.push(`  ${info.headline}`);
    rows.push(
      `  effective: ${info.effective ?? "n/a"}  →  expires: ${info.expires ?? "n/a"}`,
    );
    const areas = info.area
      .map((a) => a.areaDesc)
      .filter(Boolean)
      .slice(0, 4)
      .join("; ");
    if (areas) rows.push(`  areas: ${areas}`);
    rows.push("");
  }

  const header =
    areaKey === "esp"
      ? `Active warnings in Spain (${docs.length} document${docs.length === 1 ? "" : "s"}, showing ${kept})`
      : `Active warnings in ${areaKey} (${docs.length} document${docs.length === 1 ? "" : "s"}, showing ${kept})`;
  if (kept === 0) return `${header}\nNone match the requested severity threshold.`;
  return `${header}\n\n${rows.join("\n").trim()}`;
}
