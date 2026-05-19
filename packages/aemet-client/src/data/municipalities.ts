import data from "./municipalities.json" with { type: "json" };
import type { Municipality } from "./types.js";

export const MUNICIPALITIES: readonly Municipality[] = data as Municipality[];
