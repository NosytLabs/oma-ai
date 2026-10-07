import { expect, it } from "vitest";
import { createStreamTokenMeter, estimateTokens } from "../token-utils.js";

it("estimates identical output the same way regardless of chunk boundaries", () => {
  const text = "function add(a, b) { return a + b; }";
  const meter = createStreamTokenMeter();
  for (const character of text) meter.add(character);
  expect(meter.tokens()).toBe(estimateTokens(text));
});
it("counts interleaved reasoning and tool arguments without joining their words", () => {
  const meter = createStreamTokenMeter();
  meter.add("hel", "content");
  meter.add("think", "reasoning");
  meter.add("lo", "content");
  meter.add('{"path":', "tool:0");
  meter.add('"package.json"}', "tool:0");
  expect(meter.tokens()).toBe(estimateTokens('hello think {"path":"package.json"}'));
});
