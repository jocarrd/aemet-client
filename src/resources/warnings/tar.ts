export interface TarEntry {
  name: string;
  size: number;
  content: Uint8Array;
  type: "file" | "directory" | "other";
}

const BLOCK_SIZE = 512;
const TYPE_FLAG_OFFSET = 156;
const NAME_OFFSET = 0;
const NAME_LENGTH = 100;
const SIZE_OFFSET = 124;
const SIZE_LENGTH = 12;
const PREFIX_OFFSET = 345;
const PREFIX_LENGTH = 155;
const USTAR_OFFSET = 257;
const USTAR_MAGIC = "ustar";

export function parseTar(buffer: Uint8Array): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  while (offset + BLOCK_SIZE <= buffer.length) {
    const header = buffer.subarray(offset, offset + BLOCK_SIZE);
    if (isZeroBlock(header)) break;
    const name = readHeaderName(header);
    if (!name) {
      offset += BLOCK_SIZE;
      continue;
    }
    const size = readOctal(header, SIZE_OFFSET, SIZE_LENGTH);
    const typeFlag = String.fromCharCode(header[TYPE_FLAG_OFFSET] ?? 0);
    const dataStart = offset + BLOCK_SIZE;
    const dataEnd = dataStart + size;
    if (dataEnd > buffer.length) {
      throw new Error(
        `Tar archive is truncated: entry "${name}" declares ${size} bytes but only ${buffer.length - dataStart} are available.`,
      );
    }
    const content = buffer.subarray(dataStart, dataEnd);
    entries.push({
      name,
      size,
      content,
      type: typeFlag === "0" || typeFlag === "\0" ? "file" : typeFlag === "5" ? "directory" : "other",
    });
    offset = dataStart + Math.ceil(size / BLOCK_SIZE) * BLOCK_SIZE;
  }
  return entries;
}

function readHeaderName(header: Uint8Array): string {
  const name = readString(header, NAME_OFFSET, NAME_LENGTH);
  const ustar = readString(header, USTAR_OFFSET, USTAR_MAGIC.length);
  if (ustar.startsWith(USTAR_MAGIC)) {
    const prefix = readString(header, PREFIX_OFFSET, PREFIX_LENGTH);
    if (prefix) return `${prefix}/${name}`;
  }
  return name;
}

function readString(buf: Uint8Array, offset: number, length: number): string {
  let end = offset;
  while (end < offset + length && buf[end] !== 0) end += 1;
  return new TextDecoder("utf-8").decode(buf.subarray(offset, end));
}

function readOctal(buf: Uint8Array, offset: number, length: number): number {
  const str = readString(buf, offset, length).trim();
  if (!str) return 0;
  const parsed = Number.parseInt(str, 8);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isZeroBlock(block: Uint8Array): boolean {
  for (let i = 0; i < block.length; i += 1) {
    if (block[i] !== 0) return false;
  }
  return true;
}
