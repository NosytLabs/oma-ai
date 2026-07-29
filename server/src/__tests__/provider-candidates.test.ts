import { describe, it, expect, beforeEach, vi } from "vitest";
import type { ModelDef } from "../inference/models.js";

// We'll mock provider-selector so we can control VENICE_CONFIGURED /
// SURPLUS_ENABLED per-test (these are module-level constants in the
// real module, evaluated from config at load time).
const mocks = vi.hoisted(() => ({
  VENICE_CONFIGURED: false,
  SURPLUS_ENABLED: false,
}));

vi.mock("../inference/provider-selector.js", async () => {
  const actual = await vi.importActual<typeof import("../inference/provider-selector.js")>(
    "../inference/provider-selector.js",
  );
  return {
    ...actual,
    get VENICE_CONFIGURED() {
      return mocks.VENICE_CONFIGURED;
    },
    get SURPLUS_ENABLED() {
      return mocks.SURPLUS_ENABLED;
    },
  };
});

import {
  getCandidateProviders,
  findProvidersForModel,
  isProviderConfigured,
  hasConfiguredProvider,
} from "../inference/cross-provider-router.js";

function makeModelDef(
  overrides: Partial<ModelDef> & {
    veniceId?: string;
    surplusId?: string;
    gonkaId?: string;
  } = {},
): ModelDef {
  return {
    id: "test-model",
    provider: "venice",
    primaryProvider: "venice",
    inputPricePer1M: 1,
    outputPricePer1M: 2,
    markupPercent: 25,
    category: "mid",
    maxTokens: 4096,
    supportsStreaming: true,
    capabilities: ["chat"],
    contextWindow: 100000,
    maxOutputTokens: 4096,
    ...overrides,
  } as ModelDef;
}

beforeEach(() => {
  mocks.VENICE_CONFIGURED = false;
  mocks.SURPLUS_ENABLED = false;
});

describe("isProviderConfigured", () => {
  it("venice returns VENICE_CONFIGURED flag", () => {
    mocks.VENICE_CONFIGURED = false;
    expect(isProviderConfigured("venice")).toBe(false);
    mocks.VENICE_CONFIGURED = true;
    expect(isProviderConfigured("venice")).toBe(true);
  });

  it("surplus returns SURPLUS_ENABLED flag", () => {
    mocks.SURPLUS_ENABLED = false;
    expect(isProviderConfigured("surplus")).toBe(false);
    mocks.SURPLUS_ENABLED = true;
    expect(isProviderConfigured("surplus")).toBe(true);
  });

  it("gonka always returns true (no key needed)", () => {
    expect(isProviderConfigured("gonka")).toBe(true);
  });
});

describe("findProvidersForModel", () => {
  it("returns [] when modelDef is null", async () => {
    expect(await findProvidersForModel("any-id", null)).toEqual([]);
  });

  it("returns providers whose ID field is a non-empty string", async () => {
    const def = makeModelDef({ veniceId: "v-id", gonkaId: "g-id" });
    const result = await findProvidersForModel("test", def);
    expect(result).toContain("venice");
    expect(result).toContain("gonka");
    expect(result).not.toContain("surplus");
  });

  it("omits providers whose ID field is empty or missing", async () => {
    const def = makeModelDef({ veniceId: "", gonkaId: undefined });
    const result = await findProvidersForModel("test", def);
    expect(result).toEqual([]);
  });
});

describe("hasConfiguredProvider", () => {
  it("true when primaryProvider is configured", () => {
    mocks.VENICE_CONFIGURED = true;
    const def = makeModelDef({ veniceId: "v-id", primaryProvider: "venice" });
    expect(hasConfiguredProvider(def)).toBe(true);
  });

  it("false when no provider has a valid id and primary is unconfigured", () => {
    const def = makeModelDef({
      veniceId: undefined,
      gonkaId: undefined,
      primaryProvider: "venice",
    });
    expect(hasConfiguredProvider(def)).toBe(false);
  });

  it("true when primary is unconfigured but an alternate has a valid id + creds", () => {
    mocks.SURPLUS_ENABLED = true;
    const def = makeModelDef({
      veniceId: undefined,
      surplusId: "s-id",
      gonkaId: "g-id",
      primaryProvider: "venice",
    });
    expect(hasConfiguredProvider(def)).toBe(true);
  });
});

describe("getCandidateProviders", () => {
  it("catalog-unknown model (modelDef=null) routes to gonka for free tier", async () => {
    const result = await getCandidateProviders("some-unknown-id", null);
    expect(result).toEqual({ primary: "gonka", alternates: [] });
  });

  it("configured primary returns primary + filtered alternates", async () => {
    mocks.VENICE_CONFIGURED = true;
    mocks.SURPLUS_ENABLED = true;
    const def = makeModelDef({
      veniceId: "v-id",
      surplusId: "s-id",
      gonkaId: "g-id",
      primaryProvider: "venice",
    });
    const result = await getCandidateProviders("test", def);
    expect(result?.primary).toBe("venice");
    expect(result?.alternates).toContain("surplus");
    expect(result?.alternates).toContain("gonka");
    expect(result?.alternates).not.toContain("venice");
  });

  it("unconfigured primary is promoted to first configured alternate", async () => {
    mocks.VENICE_CONFIGURED = false;
    mocks.SURPLUS_ENABLED = true;
    const def = makeModelDef({
      veniceId: "v-id", // venice has IDs but is unconfigured
      surplusId: "s-id",
      gonkaId: "g-id",
      primaryProvider: "venice",
    });
    const result = await getCandidateProviders("test", def);
    expect(result?.primary).toBe("surplus");
    expect(result?.alternates).not.toContain("surplus");
    expect(result?.alternates).toContain("gonka");
    expect(result?.alternates).not.toContain("venice"); // unconfigured, filtered out
  });

  it("returns null when nothing is configured and no provider is reachable (router should 503)", async () => {
    const def = makeModelDef({
      veniceId: undefined,
      gonkaId: undefined,
      primaryProvider: "venice",
    });
    expect(await getCandidateProviders("test", def)).toBeNull();
  });

  it("returns primary gonka when only gonka is configured for this model", async () => {
    const def = makeModelDef({
      veniceId: undefined,
      gonkaId: "g-id",
      primaryProvider: "venice",
    });
    const result = await getCandidateProviders("test", def);
    expect(result?.primary).toBe("gonka");
    expect(result?.alternates).toEqual([]);
  });
});