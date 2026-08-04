import * as fs from "node:fs";
import * as path from "node:path";

export const MODEL_OVERRIDES_FILENAME = "models-overrides.json";

export interface ModelPricingOverride {
  inputPricePer1M: number;
  outputPricePer1M: number;
  updatedAt: string;
}

export interface PersistedOverridesFile {
  schemaVersion: 1;
  updatedAt: string;
  overrides: Record<string, ModelPricingOverride>;
}

/**
 * Resolve the mutable pricing sidecar without ever pointing it at models.json.
 * MODEL_OVERRIDES_PATH may explicitly point at durable storage. Otherwise,
 * MODELS_CONFIG_PATH remains the catalog path; its directory is used for the
 * sidecar when operators provide a custom catalog location.
 */
export function resolveModelOverridesFilePath(
  cwd = process.cwd(),
  configuredCatalogPath = process.env.MODELS_CONFIG_PATH?.trim(),
): string {
  const explicitOverridePath = process.env.MODEL_OVERRIDES_PATH?.trim();
  if (explicitOverridePath) return path.resolve(explicitOverridePath);

  if (configuredCatalogPath) {
    return path.join(path.dirname(path.resolve(configuredCatalogPath)), MODEL_OVERRIDES_FILENAME);
  }

  const workingDirectory = path.resolve(cwd);
  if (fs.existsSync(path.join(workingDirectory, "models.json"))) {
    return path.join(workingDirectory, MODEL_OVERRIDES_FILENAME);
  }

  let dir = workingDirectory;
  for (let i = 0; i < 6; i += 1) {
    const packagePath = path.join(dir, "package.json");
    if (fs.existsSync(packagePath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packagePath, "utf8")) as { name?: string };
        if (packageJson.name === "oma-monorepo") {
          return path.join(dir, "server", MODEL_OVERRIDES_FILENAME);
        }
      } catch {
        // Keep walking if a parent package.json is malformed or unreadable.
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  return path.resolve(cwd, "server", MODEL_OVERRIDES_FILENAME);
}

/** Read persisted overrides for the admin catalog loader. Invalid entries are ignored. */
export function readModelPricingOverrides(
  filePath = resolveModelOverridesFilePath(),
): Record<string, ModelPricingOverride> {
  try {
    const parsed = JSON.parse(fs.readFileSync(filePath, "utf8")) as Partial<PersistedOverridesFile>;
    if (parsed.schemaVersion !== 1 || !parsed.overrides || typeof parsed.overrides !== "object") {
      return {};
    }
    return Object.fromEntries(
      Object.entries(parsed.overrides).filter(([, override]) =>
        override &&
        Number.isFinite(override.inputPricePer1M) &&
        override.inputPricePer1M >= 0 &&
        Number.isFinite(override.outputPricePer1M) &&
        override.outputPricePer1M >= 0 &&
        typeof override.updatedAt === "string",
      ),
    );
  } catch {
    return {};
  }
}
