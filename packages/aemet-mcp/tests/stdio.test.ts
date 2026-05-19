import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const BIN_PATH = resolve(
  fileURLToPath(new URL("../dist/bin.js", import.meta.url)),
);

interface RpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface RpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

class StdioHarness {
  private buffer = "";
  private pending = new Map<number, (msg: RpcResponse) => void>();
  private nextId = 1;

  constructor(readonly proc: ChildProcessWithoutNullStreams) {
    proc.stdout.setEncoding("utf8");
    proc.stdout.on("data", (chunk: string) => {
      this.buffer += chunk;
      let nl = this.buffer.indexOf("\n");
      while (nl !== -1) {
        const line = this.buffer.slice(0, nl).trim();
        this.buffer = this.buffer.slice(nl + 1);
        if (line) this.handleLine(line);
        nl = this.buffer.indexOf("\n");
      }
    });
  }

  private handleLine(line: string): void {
    try {
      const msg = JSON.parse(line) as RpcResponse;
      if (typeof msg.id === "number") {
        const resolver = this.pending.get(msg.id);
        if (resolver) {
          this.pending.delete(msg.id);
          resolver(msg);
        }
      }
    } catch {
      // ignore unparseable lines (e.g. server-initiated notifications)
    }
  }

  request(method: string, params?: unknown): Promise<RpcResponse> {
    const id = this.nextId++;
    const req: RpcRequest = { jsonrpc: "2.0", id, method, ...(params !== undefined ? { params } : {}) };
    return new Promise((resolveResp, rejectResp) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        rejectResp(new Error(`Timed out waiting for ${method} response`));
      }, 5_000);
      this.pending.set(id, (msg) => {
        clearTimeout(timer);
        resolveResp(msg);
      });
      this.proc.stdin.write(JSON.stringify(req) + "\n");
    });
  }

  notify(method: string, params?: unknown): void {
    const msg = { jsonrpc: "2.0", method, ...(params !== undefined ? { params } : {}) };
    this.proc.stdin.write(JSON.stringify(msg) + "\n");
  }

  close(): void {
    this.proc.stdin.end();
    this.proc.kill();
  }
}

function launch(env: Record<string, string | undefined> = {}): StdioHarness {
  const proc = spawn("node", [BIN_PATH], {
    env: { ...process.env, ...env },
    stdio: ["pipe", "pipe", "pipe"],
  }) as ChildProcessWithoutNullStreams;
  return new StdioHarness(proc);
}

describe("aemet-mcp binary (stdio)", () => {
  let harness: StdioHarness | undefined;

  afterEach(() => {
    harness?.close();
    harness = undefined;
  });

  it("completes the MCP handshake and lists the three tools", async () => {
    harness = launch({ AEMET_API_KEY: "dummy-key-for-test" });
    const init = await harness.request("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "smoke-test", version: "0.0.0" },
    });
    expect(init.error).toBeUndefined();
    const initResult = init.result as { serverInfo: { name: string; version: string } };
    expect(initResult.serverInfo.name).toBe("aemet-mcp");

    harness.notify("notifications/initialized");

    const list = await harness.request("tools/list");
    expect(list.error).toBeUndefined();
    const tools = (list.result as { tools: Array<{ name: string }> }).tools;
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(["get_forecast", "get_nearest_observation", "get_warnings"]);
  });

  it("rejects --help with usage on stdout, not the MCP stream", async () => {
    const result = await new Promise<{ code: number | null; stdout: string }>(
      (resolveResult) => {
        const proc = spawn("node", [BIN_PATH, "--help"], {
          env: { ...process.env, AEMET_API_KEY: "dummy" },
        });
        let stdout = "";
        proc.stdout.on("data", (c) => (stdout += String(c)));
        proc.on("exit", (code) => resolveResult({ code, stdout }));
      },
    );
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("aemet-mcp");
    expect(result.stdout).toContain("AEMET_API_KEY");
  });
});
