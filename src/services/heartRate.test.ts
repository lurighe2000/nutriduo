import { describe, expect, it } from "vitest";
import { parseHeartRate } from "./heartRate";

describe("pulsómetro", () => {
  it("lee pulsaciones de 8 y 16 bits", () => {
    expect(parseHeartRate(new DataView(new Uint8Array([0, 142]).buffer))).toBe(
      142,
    );
    expect(
      parseHeartRate(new DataView(new Uint8Array([1, 44, 1]).buffer)),
    ).toBe(300);
  });
});
