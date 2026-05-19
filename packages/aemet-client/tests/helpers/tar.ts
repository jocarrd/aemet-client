export interface TarFile {
  name: string;
  content: Uint8Array | string;
}

const BLOCK = 512;

export function buildTar(files: TarFile[]): Uint8Array {
  const encoder = new TextEncoder();
  const blocks: Uint8Array[] = [];
  for (const f of files) {
    const content = typeof f.content === "string" ? encoder.encode(f.content) : f.content;
    const header = new Uint8Array(BLOCK);
    const { name, prefix } = splitName(f.name);
    writeString(header, name, 0, 100);
    writeOctal(header, 0o644, 100, 8);
    writeOctal(header, 0, 108, 8);
    writeOctal(header, 0, 116, 8);
    writeOctal(header, content.length, 124, 12);
    writeOctal(header, 0, 136, 12);
    header.fill(0x20, 148, 156);
    header[156] = "0".charCodeAt(0);
    writeString(header, "ustar", 257, 6);
    writeString(header, "00", 263, 2);
    if (prefix) writeString(header, prefix, 345, 155);
    const checksum = header.reduce((sum, b) => sum + b, 0);
    writeOctal(header, checksum, 148, 7);
    header[155] = 0x20;
    blocks.push(header);
    if (content.length > 0) {
      const padded = new Uint8Array(Math.ceil(content.length / BLOCK) * BLOCK);
      padded.set(content, 0);
      blocks.push(padded);
    }
  }
  blocks.push(new Uint8Array(BLOCK));
  blocks.push(new Uint8Array(BLOCK));
  const total = blocks.reduce((acc, b) => acc + b.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const b of blocks) {
    out.set(b, offset);
    offset += b.length;
  }
  return out;
}

function writeString(buf: Uint8Array, str: string, offset: number, length: number): void {
  const encoded = new TextEncoder().encode(str);
  buf.set(encoded.subarray(0, length), offset);
}

function splitName(fullName: string): { name: string; prefix: string } {
  if (fullName.length <= 100) return { name: fullName, prefix: "" };
  for (let i = fullName.length - 1; i >= 0; i -= 1) {
    if (fullName[i] !== "/") continue;
    const nameLen = fullName.length - 1 - i;
    if (nameLen === 0 || nameLen > 100) continue;
    if (i > 155) break;
    return { name: fullName.slice(i + 1), prefix: fullName.slice(0, i) };
  }
  return { name: fullName.slice(0, 100), prefix: "" };
}

function writeOctal(buf: Uint8Array, value: number, offset: number, length: number): void {
  const str = value.toString(8).padStart(length - 1, "0");
  writeString(buf, str, offset, length - 1);
  buf[offset + length - 1] = 0;
}
