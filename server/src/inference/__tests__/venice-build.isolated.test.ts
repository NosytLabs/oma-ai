import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const allowNonPrivateState = { value: false };

vi.mock("../../config.js", () => ({
  config: {
    get OMMA_ALLOW_NON_PRIVATE_VENICE() {
      return allowNonPrivateState.value;
    },
    NODE_ENV: "test",
    JWT_SECRET: "test-jwt-secret-must-be-at-least-32-chars-long",
  },
}));

import { buildVeniceChatCompletion } from "../venice.js";

describe("buildVeniceChatCompletion — private mode (X-OMA-Private forwarding)", () => {
  beforeEach(() => {
    allowNonPrivateState.value = false;
  });

  afterEach(() => {
    allowNonPrivateState.value = false;
  });

  it("defaults to private:true when no caller flag is provided", () => {
    const out = buildVeniceChatCompletion({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(out.venice_parameters).toEqual({ private: true });
  });

  it("threads private:true into venice_parameters.private", () => {
    const out = buildVeniceChatCompletion({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
      private: true,
    });
    expect(out.venice_parameters).toEqual({ private: true });
  });

  it("forces private:true even when caller passes private:false (default config)", () => {
    const out = buildVeniceChatCompletion({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
      private: false,
    });
    expect(out.venice_parameters).toEqual({ private: true });
  });

  it("honors caller private:false when OMMA_ALLOW_NON_PRIVATE_VENICE=true", () => {
    allowNonPrivateState.value = true;
    const out = buildVeniceChatCompletion({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
      private: false,
    });
    expect(out.venice_parameters).toEqual({ private: false });
  });

  it("still defaults to private:true when OMMA_ALLOW_NON_PRIVATE_VENICE=true and caller omits flag", () => {
    allowNonPrivateState.value = true;
    const out = buildVeniceChatCompletion({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
    });
    expect(out.venice_parameters).toEqual({ private: true });
  });

  it("combines private with other venice_parameters without leaking 'private' to top level", () => {
    const out = buildVeniceChatCompletion({
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "hi" }],
      stream: false,
      private: true,
      enable_web_search: "auto",
      strip_thinking_response: true,
    });
    expect(out.venice_parameters).toEqual({
      enable_web_search: "auto",
      strip_thinking_response: true,
      private: true,
    });
    // 'private' must NOT pollute the top-level body sent to Venice.
    expect(out).not.toHaveProperty("private");
    // model/messages/stream must stay at top level.
    expect(out.model).toBe("llama-3.3-70b");
    expect(out.messages).toEqual([{ role: "user", content: "hi" }]);
    expect(out.stream).toBe(false);
  });
});
