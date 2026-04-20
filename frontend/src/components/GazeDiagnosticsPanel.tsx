import type { RefObject } from "react";

import type { CalibrationTelemetry } from "../lib/gazeCalibrationV2";
import type { GazeFrame } from "../types";

type GazeDiagnosticsPanelProps = {
  mode: "mediapipe" | "pointer";
  frame: GazeFrame | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  overlayRef: RefObject<HTMLCanvasElement | null>;
  cameraReady: boolean;
  cameraError: string | null;
  telemetry: CalibrationTelemetry | null;
};

export function GazeDiagnosticsPanel({
  mode,
  frame,
  videoRef,
  overlayRef,
  cameraReady,
  cameraError,
  telemetry,
}: GazeDiagnosticsPanelProps) {
  return (
    <section className="status-card gaze-preview-card">
      <p className="eyebrow">Vista de cámara</p>
      <h3>Face mesh + iris</h3>
      <div className="camera-preview">
        {mode === "mediapipe" ? (
          <>
            <video ref={videoRef as RefObject<HTMLVideoElement>} className="camera-preview__video" autoPlay muted playsInline />
            <canvas ref={overlayRef as RefObject<HTMLCanvasElement>} className="camera-preview__overlay" />
          </>
        ) : (
          <div className="camera-preview__placeholder">
            <strong>Modo puntero</strong>
            <span>La webcam queda desactivada para depurar la UI y el dwell.</span>
          </div>
        )}
      </div>
      <ul>
        <li>{cameraReady ? "Webcam activa" : cameraError ?? "Esperando webcam"}</li>
        <li>{frame?.faceDetected ? "Cara detectada" : "Cara no detectada"}</li>
        <li>{frame?.irisDetected ? "Iris detectado" : "Iris no detectado"}</li>
        <li>Landmarks: {frame?.diagnostics.landmarksCount ?? 0}</li>
        <li>Confianza: {Math.round((frame?.confidence ?? 0) * 100)}%</li>
        <li>Senal X: {telemetry ? telemetry.signalX.toFixed(4) : "--"}</li>
        <li>Senal Y: {telemetry ? telemetry.signalY.toFixed(4) : "--"}</li>
        <li>Norm X: {telemetry?.normalizedX !== null && telemetry?.normalizedX !== undefined ? telemetry.normalizedX.toFixed(3) : "--"}</li>
        <li>Norm Y: {telemetry?.normalizedY !== null && telemetry?.normalizedY !== undefined ? telemetry.normalizedY.toFixed(3) : "--"}</li>
        <li>Map X: {telemetry?.mappedX !== null && telemetry?.mappedX !== undefined ? Math.round(telemetry.mappedX) : "--"}</li>
        <li>Map Y: {telemetry?.mappedY !== null && telemetry?.mappedY !== undefined ? Math.round(telemetry.mappedY) : "--"}</li>
      </ul>
    </section>
  );
}
