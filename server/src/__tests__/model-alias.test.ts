import { describe, it, expect } from "vitest";
import { resolveModelAlias, ALIAS_MAP } from "../inference/cross-provider-router.js";

describe("resolveModelAlias", () => {
  it("resolves a known alias to its catalog target", async () => {
    for (const [alias, target] of Object.entries(ALIAS_MAP)) {
      expect(await resolveModelAlias(alias), `alias '${alias}'`).toBe(target);
    }
  });

  it("passes through a real catalog id unchanged (no alias map hit)", async () => {
    // llama-3.3-70b is a real catalog id and also a target — both should
    // return the same value. The function is an idempotent identity for
    // any id not in ALIAS_MAP.
    const realId = "openai-gpt-5.4";
    expect(await resolveModelAlias(realId)).toBe(realId);
  });

  it("passes through a fully-qualified catalog id even if it equals an alias target", async () => {
    // The catalog uses 'llama-3.3-70b' as its id; both the alias 'llama'
    // and the real id 'llama-3.3-70b' should resolve to 'llama-3.3-70b'.
    expect(await resolveModelAlias("llama-3.3-70b")).toBe("llama-3.3-70b");
  });

  it("passes through an unknown id unchanged (no throw)", async () => {
    // Negative case: the alias map only contains legacy OpenAI-style
    // names. Any modern OMA id should pass through untouched.
    expect(await resolveModelAlias("some-future-model")).toBe("some-future-model");
    expect(await resolveModelAlias("")).toBe("");
  });

  it("every ALIAS_MAP target exists in the loaded model catalog", async () => {
    // Regression guard: if a future maintainer renames a catalog id and
    // forgets to update ALIAS_MAP, callers would resolve to a phantom
    // model. This test makes that drift visible.
    const { reloadModelCatalog, getModel } = await import(
      "../inference/models.js"
    );
    await reloadModelCatalog();
    for (const [alias, target] of Object.entries(ALIAS_MAP)) {
      const def = await getModel(target);
      expect(def, `alias '${alias}' → '${target}' should resolve to a real catalog model`).not.toBeNull();
    }
  });
});