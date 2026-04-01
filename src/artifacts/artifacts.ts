// src/artifacts/artifacts.ts
import type { ArtifactType } from "../../types/commands.js";

export function resolveArtifactPath(
  objDir: string,
  type: ArtifactType,
  number?: number,
): string {
  switch (type) {
    case "scope":
      return `${objDir}/scope.md`;
    case "plan":
      return `${objDir}/plan.md`;
    case "research": {
      const n = number ?? 1;
      const padded = String(n).padStart(3, "0");
      return `${objDir}/research/${padded}.md`;
    }
    case "changelog":
      return "CHANGELOG.md";
  }
}

export interface ArtifactInfo {
  type: ArtifactType;
  path: string;
  exists: boolean;
}

export function listArtifacts(objDir: string, existingFiles: string[]): ArtifactInfo[] {
  const types: ArtifactType[] = ["research", "scope", "plan", "changelog"];
  const results: ArtifactInfo[] = [];

  for (const type of types) {
    if (type === "research") {
      const researchFiles = existingFiles.filter((f) => f.startsWith(`${objDir}/research/`));
      for (const f of researchFiles) {
        results.push({ type: "research", path: f, exists: true });
      }
      if (researchFiles.length === 0) {
        results.push({ type: "research", path: resolveArtifactPath(objDir, "research"), exists: false });
      }
    } else {
      const path = resolveArtifactPath(objDir, type);
      results.push({ type, path, exists: existingFiles.includes(path) });
    }
  }

  return results;
}
