import { describe, it, expect } from "vitest";
import {
  FREE_GUEST_USER_ID,
  isFreeGuestModel,
  isFreeGuestProvider,
  isSyntheticGuestUserId,
} from "../routes/chat/free-guest.js";

describe("free-guest auth decision", () => {
  it("treats gonka provider as free guest chat", () => {
    expect(isFreeGuestProvider("gonka")).toBe(true);
    expect(isFreeGuestModel({ provider: "gonka" })).toBe(true);
  });

  it("rejects paid providers", () => {
    expect(isFreeGuestProvider("venice")).toBe(false);
    expect(isFreeGuestProvider("surplus")).toBe(false);
    expect(isFreeGuestModel({ provider: "venice" })).toBe(false);
    expect(isFreeGuestModel(null)).toBe(false);
  });

  it("uses a stable synthetic guest user id", () => {
    expect(FREE_GUEST_USER_ID).toBe("oma-ai-guest");
    expect(isSyntheticGuestUserId(FREE_GUEST_USER_ID)).toBe(true);
    expect(isSyntheticGuestUserId("x402-guest")).toBe(true);
    expect(isSyntheticGuestUserId("user-uuid-not-guest")).toBe(false);
  });
});
