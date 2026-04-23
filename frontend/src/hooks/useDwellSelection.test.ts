import type { FocusableTarget } from "../lib/selection";
import { resolveActiveTargetId } from "./useDwellSelection";

const targets: FocusableTarget[] = [
  { id: "decision-no", x: 0, y: 100, width: 320, height: 300 },
  { id: "decision-yes", x: 680, y: 100, width: 320, height: 300 },
];

describe("useDwellSelection target resolution", () => {
  it("does not fall back to snap targeting when a custom resolver returns null", () => {
    const targetId = resolveActiveTargetId({
      gazePoint: { x: 350, y: 200 },
      targets,
      snapRadius: 80,
      resolveTargetId: () => null,
    });

    expect(targetId).toBeNull();
  });

  it("still uses snap targeting when no custom resolver is provided", () => {
    const targetId = resolveActiveTargetId({
      gazePoint: { x: 350, y: 200 },
      targets,
      snapRadius: 80,
    });

    expect(targetId).toBe("decision-no");
  });
});
