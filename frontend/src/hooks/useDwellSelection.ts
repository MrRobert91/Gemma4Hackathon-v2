import { useEffect, useRef, useState } from "react";

import { advanceDwell, type FocusableTarget, resolveFocusTarget } from "../lib/selection";
import type { GazePoint } from "../types";

type UseDwellSelectionOptions = {
  gazePoint: GazePoint | null;
  dwellMs: number;
  snapRadius: number;
  onActivate: (targetId: string) => void;
  resolveTargetId?: (gazePoint: GazePoint | null, targets: FocusableTarget[]) => string | null;
};

export function useDwellSelection({
  gazePoint,
  dwellMs,
  snapRadius,
  onActivate,
  resolveTargetId,
}: UseDwellSelectionOptions) {
  const targetsRef = useRef<Map<string, HTMLElement>>(new Map());
  const previousTimestampRef = useRef<number | null>(null);
  const [focusedKeyId, setFocusedKeyId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!gazePoint) {
      setFocusedKeyId(null);
      setProgress(0);
      previousTimestampRef.current = null;
      return;
    }

    const targets: FocusableTarget[] = Array.from(targetsRef.current.entries()).map(([id, element]) => {
      const rect = element.getBoundingClientRect();
      return {
        id,
        x: rect.left,
        y: rect.top,
        width: rect.width,
        height: rect.height,
      };
    });

    const nextTargetId = resolveTargetId?.(gazePoint, targets) ?? resolveFocusTarget(targets, gazePoint, snapRadius)?.id ?? null;

    setFocusedKeyId((previousTargetId) => {
      const now = performance.now();
      const delta = previousTimestampRef.current === null ? 0 : now - previousTimestampRef.current;
      previousTimestampRef.current = now;

      setProgress((previousProgress) => {
        const nextState = advanceDwell(
          {
            targetId: previousTargetId,
            elapsedMs: previousProgress * dwellMs,
            progress: previousProgress,
            activatedTargetId: null,
          },
          nextTargetId,
          delta,
          dwellMs,
        );
        if (nextState.activatedTargetId) {
          onActivate(nextState.activatedTargetId);
          previousTimestampRef.current = null;
          return 0;
        }
        return nextState.progress;
      });

      return nextTargetId;
    });
  }, [dwellMs, gazePoint, onActivate, resolveTargetId, snapRadius]);

  return {
    focusedKeyId,
    dwellProgress: progress,
    registerTarget: (id: string) => (element: HTMLElement | null) => {
      if (element) {
        targetsRef.current.set(id, element);
      } else {
        targetsRef.current.delete(id);
      }
    },
    resetDwell: () => {
      setFocusedKeyId(null);
      setProgress(0);
      previousTimestampRef.current = null;
    },
  };
}
