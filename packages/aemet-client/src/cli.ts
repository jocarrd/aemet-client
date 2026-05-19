import { parseArgs } from "node:util";
import { AemetClient, AemetError, type AemetClientConfig } from "./index.js";

export interface CliDeps {
  createClient?: (config: AemetClientConfig) => AemetClient;
  stdout?: { write: (chunk: string | Uint8Array) => unknown };
  stderr?: { write: (chunk: string | Uint8Array) => unknown };
}

const HELP = `aemet-client — command-line interface for the AEMET OpenData API

Usage:
  aemet-client <command> [arguments] [options]

Commands:
  forecast <municipio>          Municipal forecast (daily by default)
                                  --hourly        Hourly forecast (40 h)
  warnings <area>               Active CAP warnings for a region
                                  area: "esp" or 2-digit code
  station <idema>               24 h history for a station
  stations                      Latest reading from every station
  climate <idema>               Daily climatological values
                                  --from YYYY-MM-DD (required)
                                  --to YYYY-MM-DD (required)
  beach <playa>                 Beach forecast
  radar [regional-code]         Radar image URL (national if no code)
                                  --download      Download bytes to stdout
  --help, -h                    Show this help

Options (any command):
  --api-key <key>               AEMET API key (overrides AEMET_API_KEY)
  --json                        Print raw JSON instead of a summary

Environment:
  AEMET_API_KEY                 API key, used when --api-key is not given.

Examples:
  aemet-client forecast 28079
  aemet-client warnings 73 --json
  aemet-client climate 3195 --from 2026-01-01 --to 2026-01-31
`;

interface CliFlags {
  "api-key"?: string;
  json?: boolean;
  hourly?: boolean;
  from?: string;
  to?: string;
  download?: boolean;
  help?: boolean;
}

export async function run(argv: string[], deps: CliDeps = {}): Promise<number> {
  const stdout = deps.stdout ?? process.stdout;
  const stderr = deps.stderr ?? process.stderr;
  const createClient = deps.createClient ?? ((cfg: AemetClientConfig) => new AemetClient(cfg));

  let parsed;
  try {
    parsed = parseArgs({
      args: argv,
      allowPositionals: true,
      options: {
        "api-key": { type: "string" },
        json: { type: "boolean", default: false },
        hourly: { type: "boolean", default: false },
        from: { type: "string" },
        to: { type: "string" },
        download: { type: "boolean", default: false },
        help: { type: "boolean", short: "h", default: false },
      },
    });
  } catch (error) {
    stderr.write(`${(error as Error).message}\n\n${HELP}`);
    return 2;
  }

  const flags = parsed.values as CliFlags;
  const [command, ...rest] = parsed.positionals;

  if (flags.help || !command) {
    stdout.write(HELP);
    return 0;
  }

  try {
    const client = createClient({
      ...(flags["api-key"] !== undefined ? { apiKey: flags["api-key"] } : {}),
    });
    return await dispatch(client, command, rest, flags, stdout, stderr);
  } catch (error) {
    if (error instanceof AemetError) {
      stderr.write(`${error.name}: ${error.message}\n`);
      if (error.status !== undefined) stderr.write(`  status: ${error.status}\n`);
      if (error.endpoint !== undefined) stderr.write(`  endpoint: ${error.endpoint}\n`);
      return 1;
    }
    stderr.write(`Unexpected error: ${(error as Error).message}\n`);
    return 1;
  }
}

type Writer = { write: (chunk: string | Uint8Array) => unknown };

async function dispatch(
  client: AemetClient,
  command: string,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
  stderr: Writer,
): Promise<number> {
  switch (command) {
    case "forecast":
      return forecast(client, args, flags, stdout);
    case "warnings":
      return warnings(client, args, flags, stdout);
    case "station":
      return station(client, args, flags, stdout);
    case "stations":
      return stations(client, flags, stdout);
    case "climate":
      return climate(client, args, flags, stdout);
    case "beach":
      return beach(client, args, flags, stdout);
    case "radar":
      return radar(client, args, flags, stdout);
    default:
      stderr.write(`Unknown command: ${command}\n\n${HELP}`);
      return 2;
  }
}

async function forecast(
  client: AemetClient,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
): Promise<number> {
  const code = requirePositional(args, 0, "municipio");
  const data = flags.hourly
    ? await client.prediction.municipalHourly(code)
    : await client.prediction.municipalDaily(code);
  if (flags.json) return printJson(stdout, data);
  const first = data[0];
  if (!first) {
    stdout.write("No forecast data.\n");
    return 0;
  }
  stdout.write(`${first.nombre} (${first.provincia}) — issued ${first.elaborado}\n`);
  for (const day of first.prediccion.dia.slice(0, 7)) {
    if (
      "temperatura" in day &&
      day.temperatura &&
      typeof day.temperatura === "object" &&
      "maxima" in day.temperatura
    ) {
      const t = day.temperatura as { maxima: number; minima: number };
      stdout.write(`  ${day.fecha}  ${t.minima}° / ${t.maxima}°\n`);
    } else {
      stdout.write(`  ${day.fecha}\n`);
    }
  }
  return 0;
}

async function warnings(
  client: AemetClient,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
): Promise<number> {
  const area = requirePositional(args, 0, "area");
  const docs = await client.warnings.latest(area);
  if (flags.json) return printJson(stdout, docs);
  if (docs.length === 0) {
    stdout.write("No active warnings.\n");
    return 0;
  }
  for (const doc of docs) {
    const info = doc.alert.info.find((i) => i.language.startsWith("es")) ?? doc.alert.info[0];
    if (!info) continue;
    stdout.write(`[${info.severity}] ${info.event} — ${info.headline}\n`);
    stdout.write(`  effective: ${info.effective ?? "n/a"}\n`);
    stdout.write(`  expires: ${info.expires ?? "n/a"}\n`);
    for (const area of info.area.slice(0, 5)) {
      stdout.write(`  area: ${area.areaDesc}\n`);
    }
    stdout.write("\n");
  }
  return 0;
}

async function station(
  client: AemetClient,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
): Promise<number> {
  const idema = requirePositional(args, 0, "idema");
  const data = await client.observation.station(idema);
  if (flags.json) return printJson(stdout, data);
  for (const obs of data.slice(-12).reverse()) {
    stdout.write(
      `${obs.fint}  ${obs.ta ?? "—"}°C  ${obs.hr ?? "—"}%RH  ${obs.vv ?? "—"} m/s  ${obs.prec ?? "—"} mm\n`,
    );
  }
  return 0;
}

async function stations(client: AemetClient, flags: CliFlags, stdout: Writer): Promise<number> {
  const data = await client.observation.allStations();
  if (flags.json) return printJson(stdout, data);
  stdout.write(`Reporting stations: ${data.length}\n`);
  return 0;
}

async function climate(
  client: AemetClient,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
): Promise<number> {
  const idema = requirePositional(args, 0, "idema");
  if (!flags.from || !flags.to) {
    throw new AemetError("--from and --to are required for `climate`.");
  }
  const data = await client.climatology.daily(idema, flags.from, flags.to);
  if (flags.json) return printJson(stdout, data);
  stdout.write(`${data.length} daily records\n`);
  for (const row of data.slice(0, 30)) {
    stdout.write(
      `  ${row.fecha}  tmed=${row.tmed ?? "—"}  prec=${row.prec ?? "—"}  tmax=${row.tmax ?? "—"}  tmin=${row.tmin ?? "—"}\n`,
    );
  }
  if (data.length > 30) stdout.write(`  … ${data.length - 30} more rows\n`);
  return 0;
}

async function beach(
  client: AemetClient,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
): Promise<number> {
  const playa = requirePositional(args, 0, "playa");
  const data = await client.beach.forecast(playa);
  if (flags.json) return printJson(stdout, data);
  const first = data[0];
  if (!first) {
    stdout.write("No beach forecast data.\n");
    return 0;
  }
  stdout.write(`${first.nombre} (${first.municipio.nombre})\n`);
  for (const day of first.prediccion.dia) {
    const water = day.tAgua ? `water ${day.tAgua.valor1 ?? "—"}-${day.tAgua.valor2 ?? "—"}°` : "";
    const air = day.tMaxima ? `air ${day.tMaxima.valor1 ?? "—"}-${day.tMaxima.valor2 ?? "—"}°` : "";
    stdout.write(`  ${day.fecha}  ${air}  ${water}  ${day.oleaje.value}\n`);
  }
  return 0;
}

async function radar(
  client: AemetClient,
  args: string[],
  flags: CliFlags,
  stdout: Writer,
): Promise<number> {
  const code = args[0];
  if (flags.download) {
    const image = code
      ? await client.radar.regionalImage(code)
      : await client.radar.nationalImage();
    stdout.write(image.bytes);
    return 0;
  }
  const result = code ? await client.radar.regionalUrl(code) : await client.radar.nationalUrl();
  if (flags.json) return printJson(stdout, result);
  stdout.write(`${result.url}\n`);
  return 0;
}

function requirePositional(args: string[], index: number, name: string): string {
  const value = args[index];
  if (!value) throw new AemetError(`Missing required argument: <${name}>.`);
  return value;
}

function printJson(stdout: Writer, value: unknown): number {
  stdout.write(`${JSON.stringify(value, null, 2)}\n`);
  return 0;
}

const isCli = import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1] ?? "");
if (isCli) {
  run(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error) => {
      process.stderr.write(`Fatal: ${(error as Error).message}\n`);
      process.exit(1);
    },
  );
}
