const GZIP_MAGIC = [0x1f, 0x8b];

export function isGzip(buffer: Uint8Array): boolean {
  return buffer.length >= 2 && buffer[0] === GZIP_MAGIC[0] && buffer[1] === GZIP_MAGIC[1];
}

export async function gunzip(buffer: Uint8Array): Promise<Uint8Array> {
  if (typeof DecompressionStream !== "undefined") {
    return gunzipWithStream(buffer);
  }
  return gunzipWithNode(buffer);
}

async function gunzipWithStream(buffer: Uint8Array): Promise<Uint8Array> {
  const blob = new Blob([buffer as BlobPart]);
  const stream = blob.stream().pipeThrough(new DecompressionStream("gzip"));
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return out;
}

async function gunzipWithNode(buffer: Uint8Array): Promise<Uint8Array> {
  const { gunzipSync } = await import("node:zlib");
  return new Uint8Array(gunzipSync(buffer));
}
