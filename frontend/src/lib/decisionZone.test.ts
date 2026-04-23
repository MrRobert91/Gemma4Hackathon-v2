import { resolveBinaryDecisionTarget } from "./decisionZone";

describe("binary decision zone resolver", () => {
  it("returns null inside the central dead zone", () => {
    expect(resolveBinaryDecisionTarget({ x: 500, y: 100 }, 1000)).toBeNull();
  });

  it("maps left side to no and right side to yes after horizontal inversion", () => {
    expect(resolveBinaryDecisionTarget({ x: 900, y: 100 }, 1000)).toBe("decision-no");
    expect(resolveBinaryDecisionTarget({ x: 100, y: 100 }, 1000)).toBe("decision-yes");
  });

  it("can disable inversion when needed", () => {
    expect(resolveBinaryDecisionTarget({ x: 100, y: 100 }, 1000, { invertHorizontal: false })).toBe("decision-no");
    expect(resolveBinaryDecisionTarget({ x: 900, y: 100 }, 1000, { invertHorizontal: false })).toBe("decision-yes");
  });

  it("widens the neutral zone when configured", () => {
    expect(resolveBinaryDecisionTarget({ x: 360, y: 100 }, 1000, { centerDeadZoneRatio: 0.1 })).toBe("decision-yes");
    expect(resolveBinaryDecisionTarget({ x: 360, y: 100 }, 1000, { centerDeadZoneRatio: 0.4 })).toBeNull();
  });
});
