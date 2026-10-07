import { describe, expect, it } from "vitest";
import { resolveOutputBudget } from "../request-limits.js";

const model = { id: "test", maxTokens: 1024, maxOutputTokens: 4096, contextWindow: 8192 };
describe("model output and context limits", () => {
  it("uses a bounded default when max_tokens is omitted", () => {
    expect(resolveOutputBudget(model, undefined, 100)).toBe(1024);
  });
  it("rejects output over the selected model's cap", () => {
    expect(() => resolveOutputBudget(model, 4097, 100)).toThrow(/4096/);
  });
  it("leaves room for output in the context window", () => {
    expect(() => resolveOutputBudget(model, 4096, 5000)).toThrow(/context/i);
    expect(resolveOutputBudget(model, undefined, 8000)).toBe(192);
  });
});
