import { buildDecisionGridColumns, resolveBinaryDecisionTarget } from "./decisionZone";

const targets = [
  { id: "decision-no", x: 0, y: 100, width: 320, height: 300 },
  { id: "decision-yes", x: 680, y: 100, width: 320, height: 300 },
];

describe("binary decision zone resolver", () => {
  it("returns null when the gaze is in the central rest area", () => {
    expect(resolveBinaryDecisionTarget({ x: 500, y: 200 }, targets)).toBeNull();
  });

  it("maps the left box to no and the right box to yes", () => {
    expect(resolveBinaryDecisionTarget({ x: 100, y: 200 }, targets)).toBe("decision-no");
    expect(resolveBinaryDecisionTarget({ x: 900, y: 200 }, targets)).toBe("decision-yes");
  });

  it("returns null when the gaze is outside both visible boxes", () => {
    expect(resolveBinaryDecisionTarget({ x: 100, y: 40 }, targets)).toBeNull();
    expect(resolveBinaryDecisionTarget({ x: 900, y: 450 }, targets)).toBeNull();
  });

  it("builds symmetric grid columns for the configured rest width", () => {
    expect(buildDecisionGridColumns(24)).toEqual(["38%", "24%", "38%"]);
    expect(buildDecisionGridColumns(40)).toEqual(["30%", "40%", "30%"]);
  });
});
