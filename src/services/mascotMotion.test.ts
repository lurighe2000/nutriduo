import { describe, expect, it } from "vitest";
import { companionGesture } from "./mascotMotion";

describe("companion gestures", () => {
  it("offers everyday play without requiring food or exercise to unlock it", () => {
    const gestures = new Set(
      Array.from({ length: 12 }, (_, i) =>
        companionGesture("stitch", "neutral", i),
      ),
    );
    expect(gestures).toEqual(new Set(["scratch", "look", "nose", "wave"]));
    expect(gestures.has("celebrate")).toBe(false);
  });
  it("keeps the inverted routine specific to Stitch and avoids it during support", () => {
    for (const mood of ["neutral", "support", "happy", "celebrate"] as const) {
      const angel = Array.from({ length: 12 }, (_, i) =>
        companionGesture("angel", mood, i),
      );
      expect(angel).not.toContain("headstand");
    }
    const support = Array.from({ length: 8 }, (_, i) =>
      companionGesture("stitch", "support", i),
    );
    expect(support).not.toContain("headstand");
    expect(
      Array.from({ length: 12 }, (_, i) =>
        companionGesture("stitch", "happy", i),
      ),
    ).toContain("headstand");
  });
});
