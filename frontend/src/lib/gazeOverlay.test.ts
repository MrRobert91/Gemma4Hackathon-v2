import { mirrorPreviewBox, mirrorPreviewX } from "./gazeOverlay";

describe("gaze overlay mirroring", () => {
  it("mirrors normalized x coordinates to match mirrored webcam preview", () => {
    expect(mirrorPreviewX(0.2, 640)).toBeCloseTo(512);
    expect(mirrorPreviewX(0.5, 640)).toBeCloseTo(320);
    expect(mirrorPreviewX(0.8, 640)).toBeCloseTo(128);
  });

  it("mirrors face boxes without changing size", () => {
    expect(
      mirrorPreviewBox(
        {
          x: 120,
          y: 80,
          width: 180,
          height: 200,
        },
        640,
      ),
    ).toEqual({
      x: 340,
      y: 80,
      width: 180,
      height: 200,
    });
  });
});
