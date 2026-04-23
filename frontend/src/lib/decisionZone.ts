import type { GazePoint } from "../types";

type DecisionZoneOptions = {
  centerDeadZoneRatio?: number;
  invertHorizontal?: boolean;
};

export function resolveBinaryDecisionTarget(
  gazePoint: GazePoint | null,
  viewportWidth: number,
  options: DecisionZoneOptions = {},
): "decision-no" | "decision-yes" | null {
  if (!gazePoint || viewportWidth <= 0) {
    return null;
  }

  const { centerDeadZoneRatio = 0.24, invertHorizontal = true } = options;
  const normalizedX = Math.min(Math.max(gazePoint.x / viewportWidth, 0), 1);
  const effectiveX = invertHorizontal ? 1 - normalizedX : normalizedX;
  const deadZoneHalf = centerDeadZoneRatio / 2;
  const centerStart = 0.5 - deadZoneHalf;
  const centerEnd = 0.5 + deadZoneHalf;

  if (effectiveX >= centerStart && effectiveX <= centerEnd) {
    return null;
  }

  return effectiveX < centerStart ? "decision-no" : "decision-yes";
}
