import { useEffect, useRef, useState } from "react";

import type { GazePoint } from "../types";

type ProviderMode = "webgazer" | "pointer";

type UseEyeTrackingOptions = {
  mode: ProviderMode;
};

type EyeTrackingState = {
  point: GazePoint | null;
  ready: boolean;
  providerLabel: string;
  error: string | null;
};

declare global {
  interface Window {
    webgazer?: {
      setGazeListener: (
        handler: (data: { x: number; y: number } | null, elapsedTime: number) => void,
      ) => unknown;
      saveDataAcrossSessions: (enabled: boolean) => unknown;
      showVideoPreview: (enabled: boolean) => unknown;
      showPredictionPoints: (enabled: boolean) => unknown;
      begin: () => Promise<unknown>;
      end: () => Promise<unknown>;
      recordScreenPosition?: (x: number, y: number, eventType?: string) => void;
    };
  }
}

const WEBGAZER_URL = "https://webgazer.cs.brown.edu/webgazer.js";

function ensureWebGazerScript(): Promise<void> {
  if (window.webgazer) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-webgazer="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("No se pudo cargar WebGazer")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = WEBGAZER_URL;
    script.async = true;
    script.dataset.webgazer = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("No se pudo cargar WebGazer"));
    document.body.appendChild(script);
  });
}

export function useEyeTracking({ mode }: UseEyeTrackingOptions): EyeTrackingState {
  const [point, setPoint] = useState<GazePoint | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pointerHandlerRef = useRef<((event: PointerEvent) => void) | null>(null);

  useEffect(() => {
    setReady(false);
    setError(null);

    if (mode === "pointer") {
      const handler = (event: PointerEvent) => {
        setPoint({ x: event.clientX, y: event.clientY });
      };
      pointerHandlerRef.current = handler;
      window.addEventListener("pointermove", handler, { passive: true });
      setReady(true);
      return () => {
        if (pointerHandlerRef.current) {
          window.removeEventListener("pointermove", pointerHandlerRef.current);
        }
      };
    }

    let mounted = true;
    void ensureWebGazerScript()
      .then(async () => {
        if (!mounted || !window.webgazer) {
          return;
        }
        window.webgazer.saveDataAcrossSessions(false);
        window.webgazer.showVideoPreview(false);
        window.webgazer.showPredictionPoints(false);
        window.webgazer.setGazeListener((data) => {
          if (data) {
            setPoint({ x: data.x, y: data.y });
          }
        });
        await window.webgazer.begin();
        if (mounted) {
          setReady(true);
        }
      })
      .catch((reason) => {
        if (mounted) {
          setError(reason instanceof Error ? reason.message : "Error cargando eye tracking");
        }
      });

    return () => {
      mounted = false;
      if (window.webgazer) {
        void window.webgazer.end();
      }
    };
  }, [mode]);

  return {
    point,
    ready,
    providerLabel: mode === "webgazer" ? "WebGazer + webcam" : "Modo puntero",
    error,
  };
}
