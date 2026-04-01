import { twisted } from "./twisted.js";
import { superpowers } from "./superpowers.js";
import { minimal } from "./minimal.js";
import type { PresetOverrides } from "../../types/preset.js";

export { twisted, superpowers, minimal };

export const allPresets: Record<string, PresetOverrides> = {
  twisted,
  superpowers,
  minimal,
};
