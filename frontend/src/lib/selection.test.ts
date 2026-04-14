import {
  advanceDwell,
  createDwellState,
  resolveFocusTarget,
  type FocusableTarget,
} from "./selection";

const targets: FocusableTarget[] = [
  { id: "a", x: 10, y: 10, width: 120, height: 120 },
  { id: "b", x: 150, y: 10, width: 120, height: 120 },
];

describe("selection engine", () => {
  it("snaps gaze to the closest target within radius", () => {
    const target = resolveFocusTarget(targets, { x: 128, y: 40 }, 40);
    expect(target?.id).toBe("a");
  });

  it("activates a target after the dwell threshold", () => {
    let state = createDwellState();

    state = advanceDwell(state, "a", 300, 800);
    expect(state.progress).toBeCloseTo(0.375);
    expect(state.activatedTargetId).toBeNull();

    state = advanceDwell(state, "a", 600, 800);
    expect(state.activatedTargetId).toBe("a");
  });

  it("resets dwell accumulation when the target changes", () => {
    let state = createDwellState();

    state = advanceDwell(state, "a", 500, 800);
    state = advanceDwell(state, "b", 100, 800);

    expect(state.targetId).toBe("b");
    expect(state.elapsedMs).toBe(100);
    expect(state.progress).toBeCloseTo(0.125);
  });
});
