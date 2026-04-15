import {
  applyCalibrationToFrame,
  buildCalibrationModelV2,
  createEmptyCalibrationModelV2,
  isFeatureWindowStable,
  isCalibrationWindowStable,
} from "./gazeCalibrationV2";
import type { CalibrationSampleV2, GazeFeatureVector } from "../types";

function createFeatures(xBias: number, yBias: number): GazeFeatureVector {
  return {
    leftIrisX: 0.35 + xBias,
    leftIrisY: 0.5 + yBias,
    rightIrisX: 0.65 + xBias,
    rightIrisY: 0.5 + yBias,
    leftEyeOpen: 0.24,
    rightEyeOpen: 0.23,
    interocularDistance: 0.3,
    faceCenterX: 0.5,
    faceCenterY: 0.5,
    faceWidth: 0.44,
    faceHeight: 0.58,
    yaw: xBias * 1.2,
    pitch: yBias * 1.2,
    roll: 0,
  };
}

describe("feature-based calibration", () => {
  it("returns an empty model when there are not enough stable samples", () => {
    const model = buildCalibrationModelV2([]);
    expect(model).toEqual(createEmptyCalibrationModelV2());
  });

  it("learns a screen mapping from feature vectors", () => {
    const samples: CalibrationSampleV2[] = [
      { features: createFeatures(-0.06, -0.06), target: { x: 200, y: 160 }, quality: 0.92 },
      { features: createFeatures(0, -0.05), target: { x: 640, y: 180 }, quality: 0.95 },
      { features: createFeatures(0.05, -0.04), target: { x: 1080, y: 210 }, quality: 0.94 },
      { features: createFeatures(-0.04, 0.01), target: { x: 260, y: 420 }, quality: 0.91 },
      { features: createFeatures(0.01, 0.02), target: { x: 700, y: 470 }, quality: 0.96 },
      { features: createFeatures(0.05, 0.05), target: { x: 1100, y: 560 }, quality: 0.93 },
    ];

    const model = buildCalibrationModelV2(samples);
    const point = applyCalibrationToFrame(createFeatures(0.02, 0.015), model);

    expect(model.sampleCount).toBe(samples.length);
    expect(model.score).toBeGreaterThan(0.7);
    expect(point.x).toBeGreaterThan(700);
    expect(point.x).toBeLessThan(820);
    expect(point.y).toBeGreaterThan(400);
    expect(point.y).toBeLessThan(500);
  });

  it("detects when a calibration window is stable enough to capture", () => {
    const stableWindow = [
      { x: 502, y: 401 },
      { x: 504, y: 399 },
      { x: 500, y: 403 },
      { x: 503, y: 400 },
    ];
    const unstableWindow = [
      { x: 420, y: 300 },
      { x: 550, y: 410 },
      { x: 510, y: 460 },
      { x: 610, y: 350 },
    ];

    expect(isCalibrationWindowStable(stableWindow, 18)).toBe(true);
    expect(isCalibrationWindowStable(unstableWindow, 18)).toBe(false);
  });

  it("detects stable feature windows independently from the raw point spread", () => {
    const stableFeatures = [
      createFeatures(0.01, -0.01),
      createFeatures(0.011, -0.009),
      createFeatures(0.009, -0.011),
      createFeatures(0.01, -0.008),
    ];
    const unstableFeatures = [
      createFeatures(-0.08, -0.05),
      createFeatures(0.01, 0.04),
      createFeatures(0.06, -0.02),
      createFeatures(-0.03, 0.08),
    ];

    expect(isFeatureWindowStable(stableFeatures, 0.08)).toBe(true);
    expect(isFeatureWindowStable(unstableFeatures, 0.08)).toBe(false);
  });
});
