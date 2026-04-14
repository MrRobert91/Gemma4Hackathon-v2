import {
  applyCalibration,
  buildCalibrationModel,
  identityCalibration,
  type CalibrationSample,
} from "./calibration";

describe("calibration model", () => {
  it("returns identity when there are not enough samples", () => {
    const model = buildCalibrationModel([]);
    expect(model).toEqual(identityCalibration());
  });

  it("fits a simple affine transform for screen coordinates", () => {
    const samples: CalibrationSample[] = [
      { raw: { x: 100, y: 100 }, target: { x: 120, y: 140 } },
      { raw: { x: 200, y: 200 }, target: { x: 230, y: 250 } },
      { raw: { x: 300, y: 300 }, target: { x: 340, y: 360 } },
    ];

    const model = buildCalibrationModel(samples);
    const corrected = applyCalibration({ x: 250, y: 250 }, model);

    expect(corrected.x).toBeCloseTo(285, 0);
    expect(corrected.y).toBeCloseTo(305, 0);
    expect(model.score).toBeGreaterThan(0.9);
  });
});
