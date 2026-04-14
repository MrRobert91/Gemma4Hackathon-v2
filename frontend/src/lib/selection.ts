import type { GazePoint } from "../types";

export type FocusableTarget = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type DwellState = {
  targetId: string | null;
  elapsedMs: number;
  progress: number;
  activatedTargetId: string | null;
};

export function createDwellState(): DwellState {
  return {
    targetId: null,
    elapsedMs: 0,
    progress: 0,
    activatedTargetId: null,
  };
}

function distanceToRect(target: FocusableTarget, point: GazePoint): number {
  const dx = Math.max(target.x - point.x, 0, point.x - (target.x + target.width));
  const dy = Math.max(target.y - point.y, 0, point.y - (target.y + target.height));
  return Math.hypot(dx, dy);
}

export function resolveFocusTarget(
  targets: FocusableTarget[],
  point: GazePoint,
  snapRadius: number,
): FocusableTarget | null {
  let bestTarget: FocusableTarget | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of targets) {
    const distance = distanceToRect(target, point);
    if (distance <= snapRadius && distance < bestDistance) {
      bestDistance = distance;
      bestTarget = target;
    }
  }

  return bestTarget;
}

export function advanceDwell(
  state: DwellState,
  nextTargetId: string | null,
  deltaMs: number,
  thresholdMs: number,
): DwellState {
  if (nextTargetId === null) {
    return createDwellState();
  }

  const sameTarget = nextTargetId === state.targetId;
  const elapsedMs = sameTarget ? state.elapsedMs + deltaMs : deltaMs;
  const activatedTargetId = elapsedMs >= thresholdMs ? nextTargetId : null;

  return {
    targetId: nextTargetId,
    elapsedMs,
    progress: Math.min(elapsedMs / thresholdMs, 1),
    activatedTargetId,
  };
}
