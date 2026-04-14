import type { GazeFrame, GazePoint, GazeProviderStatus } from "../types";
import type { GazeProvider } from "./gazeProvider";

export class RemotePythonProvider implements GazeProvider {
  private status: GazeProviderStatus = "failed";
  private latestFrame: GazeFrame | null = null;

  async init() {
    this.status = "failed";
  }

  async start() {
    this.status = "failed";
  }

  async stop() {
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
