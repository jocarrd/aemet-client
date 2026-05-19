import { describe, expect, it } from "vitest";
import { AemetClient } from "../src/client.js";
import { run } from "../src/cli.js";
import type { FetchLike } from "../src/transport.js";

function captureOutput() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    stdout: { write: (c: string | Uint8Array) => out.push(String(c)) },
    stderr: { write: (c: string | Uint8Array) => err.push(String(c)) },
    out: () => out.join(""),
    err: () => err.join(""),
  };
}

function fixtureClient(responses: Array<{ status: number; body: unknown }>) {
  let i = 0;
  const fetch: FetchLike = async () => {
    const r = responses[i++];
    if (!r) throw new Error("unexpected fetch");
    return new Response(JSON.stringify(r.body), {
      status: r.status,
      headers: { "content-type": "application/json" },
    });
  };
  return new AemetClient({ apiKey: "k", fetch, retryBaseDelayMs: 1 });
}

describe("CLI", () => {
  it("prints help with --help", async () => {
    const cap = captureOutput();
    const code = await run(["--help"], { stdout: cap.stdout, stderr: cap.stderr });
    expect(code).toBe(0);
    expect(cap.out()).toContain("aemet-client");
    expect(cap.out()).toContain("Commands:");
  });

  it("prints help when no command is given", async () => {
    const cap = captureOutput();
    const code = await run([], { stdout: cap.stdout, stderr: cap.stderr });
    expect(code).toBe(0);
    expect(cap.out()).toContain("Usage:");
  });

  it("rejects unknown commands with exit 2", async () => {
    const cap = captureOutput();
    const code = await run(["bogus"], {
      stdout: cap.stdout,
      stderr: cap.stderr,
      createClient: () => fixtureClient([]),
    });
    expect(code).toBe(2);
    expect(cap.err()).toContain("Unknown command");
  });

  it("forecast prints a summary", async () => {
    const cap = captureOutput();
    const client = fixtureClient([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      {
        status: 200,
        body: [
          {
            origen: { productor: "AEMET", web: "", enlace: "", language: "es", copyright: "", notaLegal: "" },
            elaborado: "2026-05-17",
            nombre: "Madrid",
            provincia: "Madrid",
            id: "28079",
            version: "1.0",
            prediccion: {
              dia: [
                {
                  fecha: "2026-05-17",
                  probPrecipitacion: [],
                  cotaNieveProv: [],
                  estadoCielo: [],
                  viento: [],
                  rachaMax: [],
                  temperatura: { maxima: 28, minima: 14, dato: [] },
                  sensTermica: { maxima: 27, minima: 13, dato: [] },
                  humedadRelativa: { maxima: 80, minima: 30, dato: [] },
                },
              ],
            },
          },
        ],
      },
    ]);
    const code = await run(["forecast", "28079"], {
      stdout: cap.stdout,
      stderr: cap.stderr,
      createClient: () => client,
    });
    expect(code).toBe(0);
    expect(cap.out()).toContain("Madrid");
    expect(cap.out()).toContain("14° / 28°");
  });

  it("forecast --json prints raw JSON", async () => {
    const cap = captureOutput();
    const client = fixtureClient([
      { status: 200, body: { descripcion: "exito", estado: 200, datos: "https://x/d" } },
      { status: 200, body: [{ id: "28079" }] },
    ]);
    const code = await run(["forecast", "28079", "--json"], {
      stdout: cap.stdout,
      stderr: cap.stderr,
      createClient: () => client,
    });
    expect(code).toBe(0);
    expect(JSON.parse(cap.out())).toEqual([{ id: "28079" }]);
  });

  it("climate requires --from and --to", async () => {
    const cap = captureOutput();
    const client = fixtureClient([]);
    const code = await run(["climate", "3195"], {
      stdout: cap.stdout,
      stderr: cap.stderr,
      createClient: () => client,
    });
    expect(code).toBe(1);
    expect(cap.err()).toContain("--from and --to are required");
  });

  it("radar prints the resolved URL", async () => {
    const cap = captureOutput();
    const client = fixtureClient([
      {
        status: 200,
        body: {
          descripcion: "exito",
          estado: 200,
          datos: "https://opendata.aemet.es/sh/img-vc.gif",
        },
      },
    ]);
    const code = await run(["radar", "vc"], {
      stdout: cap.stdout,
      stderr: cap.stderr,
      createClient: () => client,
    });
    expect(code).toBe(0);
    expect(cap.out().trim()).toBe("https://opendata.aemet.es/sh/img-vc.gif");
  });

  it("surfaces AemetError with exit code 1", async () => {
    const cap = captureOutput();
    const client = fixtureClient([{ status: 401, body: { mensaje: "denied" } }]);
    const code = await run(["forecast", "28079"], {
      stdout: cap.stdout,
      stderr: cap.stderr,
      createClient: () => client,
    });
    expect(code).toBe(1);
    expect(cap.err()).toContain("AemetAuthError");
    expect(cap.err()).toContain("status: 401");
  });
});
