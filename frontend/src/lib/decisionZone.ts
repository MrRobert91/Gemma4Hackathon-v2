import type { FocusableTarget } from "./selection";
import type { GazePoint } from "../types";

function containsPoint(target: FocusableTarget, point: GazePoint): boolean {
  return (
    point.x >= target.x &&
    point.x <= target.x + target.width &&
    point.y >= target.y &&
    point.y <= target.y + target.height
  );
}

export function resolveBinaryDecisionTarget(
  gazePoint: GazePoint | null,
  targets: readonly FocusableTarget[],
): "decision-no" | "decision-yes" | null {
  if (!gazePoint) {
    return null;
  }

  for (const target of targets) {
    if ((target.id === "decision-no" || target.id === "decision-yes") && containsPoint(target, gazePoint)) {
      return target.id;
    }
  }

  return null;
}

export function buildDecisionGridColumns(restPercent: number): [string, string, string] {
  const boundedRest = Math.min(Math.max(restPercent, 10), 40);
  const sidePercent = (100 - boundedRest) / 2;
  return [`${sidePercent}%`, `${boundedRest}%`, `${sidePercent}%`];
}
