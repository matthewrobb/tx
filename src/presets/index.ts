export { twisted } from "./twisted.js";
export { superpowers } from "./superpowers.js";
export { gstack } from "./gstack.js";
export { nimbalyst } from "./nimbalyst.js";
export { minimal } from "./minimal.js";

import { twisted } from "./twisted.js";
import { superpowers } from "./superpowers.js";
import { gstack } from "./gstack.js";
import { nimbalyst } from "./nimbalyst.js";
import { minimal } from "./minimal.js";
import type { PresetOverrides } from "../../types/preset.js";

export const allPresets: Record<string, PresetOverrides> = {
  twisted,
  superpowers,
  gstack,
  nimbalyst,
  minimal,
};
