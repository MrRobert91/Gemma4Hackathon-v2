import { FaceLandmarker, FilesetResolver, type FaceLandmarkerResult } from "@mediapipe/tasks-vision";

import type { GazeFrame, GazePoint, GazeProviderStatus } from "../types";
import { buildGazeFrameFromLandmarks, type FaceLandmark } from "./gazeFeatures";
import { drawGazeOverlay } from "./gazeOverlay";
import type { GazeProvider } from "./gazeProvider";

type MediapipeBrowserProviderOptions = {
  videoElement: HTMLVideoElement;
  overlayElement?: HTMLCanvasElement | null;
  getViewportSize: () => { width: number; height: number };
  onFrame: (frame: GazeFrame) => void;
  onDebug: (message: string) => void;
};

const wasmRoot = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm";
const modelAssetPath =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task";

export class MediapipeBrowserProvider implements GazeProvider {
  private status: GazeProviderStatus = "idle";
  private latestFrame: GazeFrame | null = null;
  private landmarker: FaceLandmarker | null = null;
  private animationFrameId: number | null = null;
  private lastVideoTime = -1;
  private readonly videoElement: HTMLVideoElement;
  private readonly overlayElement?: HTMLCanvasElement | null;
  private readonly getViewportSize: () => { width: number; height: number };
  private readonly onFrame: (frame: GazeFrame) => void;
  private readonly onDebug: (message: string) => void;
  private sampleCounter = 0;

  constructor({
    videoElement,
    overlayElement,
    getViewportSize,
    onFrame,
    onDebug,
  }: MediapipeBrowserProviderOptions) {
    this.videoElement = videoElement;
    this.overlayElement = overlayElement;
    this.getViewportSize = getViewportSize;
    this.onFrame = onFrame;
    this.onDebug = onDebug;
  }

  async init() {
    this.status = "loading";
    this.onDebug("cargando MediaPipe Face Landmarker");
    const fileset = await FilesetResolver.forVisionTasks(wasmRoot);
    this.landmarker = await FaceLandmarker.createFromOptions(fileset, {
      baseOptions: {
        modelAssetPath,
      },
      runningMode: "VIDEO",
      numFaces: 1,
      outputFaceBlendshapes: true,
      outputFacialTransformationMatrixes: true,
    });
    this.status = "camera_ready";
    this.onDebug("MediaPipe inicializado");
  }

  async start() {
    if (!this.landmarker) {
      throw new Error("El proveedor MediaPipe no se ha inicializado.");
    }
    this.status = "tracking";
    this.onDebug("bucle de detección iniciado");

    const tick = () => {
      if (!this.landmarker) {
        return;
      }
      if (this.videoElement.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        this.animationFrameId = window.requestAnimationFrame(tick);
        return;
      }

      if (this.videoElement.currentTime === this.lastVideoTime) {
        this.animationFrameId = window.requestAnimationFrame(tick);
        return;
      }

      this.lastVideoTime = this.videoElement.currentTime;
      const result = this.landmarker.detectForVideo(this.videoElement, performance.now());
      this.processResult(result);
      this.animationFrameId = window.requestAnimationFrame(tick);
    };

    this.animationFrameId = window.requestAnimationFrame(tick);
  }

  private processResult(result: FaceLandmarkerResult) {
    const landmarks = (result.faceLandmarks[0] ?? []) as FaceLandmark[];
    const viewport = this.getViewportSize();
    const frame = buildGazeFrameFromLandmarks({
      landmarks,
      videoWidth: this.videoElement.videoWidth || 640,
      videoHeight: this.videoElement.videoHeight || 480,
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      timestamp: performance.now(),
    });

    this.latestFrame = frame;
    this.onFrame(frame);

    if (this.overlayElement) {
      drawGazeOverlay(
        this.overlayElement,
        landmarks,
        frame,
        this.videoElement.videoWidth || 640,
        this.videoElement.videoHeight || 480,
      );
    }

    this.status = frame.irisDetected ? "ready" : frame.faceDetected ? "degraded" : "tracking";
    this.sampleCounter += 1;
    if (this.sampleCounter % 30 === 0) {
      this.onDebug(
        [
          `landmarks=${frame.diagnostics.landmarksCount}`,
          `iris=${frame.irisDetected ? "ok" : "no"}`,
          `blink=${frame.diagnostics.blink ? "yes" : "no"}`,
          `confidence=${Math.round(frame.confidence * 100)}%`,
        ].join(" | "),
      );
    }
  }

  async stop() {
    if (this.animationFrameId !== null) {
      window.cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
    this.landmarker?.close();
    this.landmarker = null;
    this.status = "idle";
  }

  getStatus() {
    return this.status;
  }

  getLatestFrame() {
    return this.latestFrame;
  }

  collectCalibrationSample(_target: GazePoint) {}
}
