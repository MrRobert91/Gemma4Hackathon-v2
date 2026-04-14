import type { GazeFrame, GazePoint, GazeProviderStatus } from "../types";
import type { GazeProvider } from "./gazeProvider";

type PointerProviderOptions = {
  onFrame: (frame: GazeFrame) => void;
};

export class PointerProvider implements GazeProvider {
  private status: GazeProviderStatus = "idle";
  private latestFrame: GazeFrame | null = null;
  private readonly onFrame: (frame: GazeFrame) => void;
  private readonly handlePointerMove = (event: PointerEvent) => {
    const point = { x: event.clientX, y: event.clientY };
    const frame: GazeFrame = {
      timestamp: performance.now(),
      point,
      rawPoint: point,
      confidence: 1,
      faceDetected: true,
      irisDetected: true,
      headPose: { yaw: 0, pitch: 0, roll: 0 },
      diagnostics: {
        landmarksCount: 0,
        blink: false,
      },
      features: null,
    };
    this.latestFrame = frame;
    this.onFrame(frame);
  };

  constructor({ onFrame }: PointerProviderOptions) {
    this.onFrame = onFrame;
  }

  async init() {
    this.status = "camera_ready";
  }

  async start() {
    window.addEventListener("pointermove", this.handlePointerMove, { passive: true });
    this.status = "ready";
  }

  async stop() {
    window.removeEventListener("pointermove", this.handlePointerMove);
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
