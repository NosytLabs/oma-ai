import { describe, expect, it } from "vitest";
import { polarApiBaseUrl } from "./polar-config.js";

describe("polarApiBaseUrl", () => {
  it("maps production to the official production API", () => {
    expect(polarApiBaseUrl("production")).toBe("https://api.polar.sh");
  });

  it("maps sandbox to the official sandbox API", () => {
    expect(polarApiBaseUrl("sandbox")).toBe("https://sandbox-api.polar.sh");
  });
});
