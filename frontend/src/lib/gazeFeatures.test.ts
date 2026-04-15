import { buildGazeFrameFromLandmarks, estimateRawScreenPoint, type FaceLandmark } from "./gazeFeatures";

function createLandmarks(): FaceLandmark[] {
  return Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
}

describe("gaze feature extraction", () => {
  it("extracts iris, pose and diagnostics from complete face landmarks", () => {
    const landmarks = createLandmarks();

    landmarks[33] = { x: 0.3, y: 0.4, z: 0 };
    landmarks[133] = { x: 0.4, y: 0.4, z: 0 };
    landmarks[159] = { x: 0.35, y: 0.37, z: 0 };
    landmarks[145] = { x: 0.35, y: 0.43, z: 0 };

    landmarks[362] = { x: 0.6, y: 0.4, z: 0 };
    landmarks[263] = { x: 0.7, y: 0.4, z: 0 };
    landmarks[386] = { x: 0.65, y: 0.37, z: 0 };
    landmarks[374] = { x: 0.65, y: 0.43, z: 0 };

    landmarks[468] = { x: 0.355, y: 0.401, z: 0 };
    landmarks[469] = { x: 0.357, y: 0.401, z: 0 };
    landmarks[470] = { x: 0.355, y: 0.404, z: 0 };
    landmarks[471] = { x: 0.353, y: 0.401, z: 0 };
    landmarks[472] = { x: 0.355, y: 0.398, z: 0 };

    landmarks[473] = { x: 0.652, y: 0.399, z: 0 };
    landmarks[474] = { x: 0.654, y: 0.399, z: 0 };
    landmarks[475] = { x: 0.652, y: 0.403, z: 0 };
    landmarks[476] = { x: 0.65, y: 0.399, z: 0 };
    landmarks[477] = { x: 0.652, y: 0.396, z: 0 };

    landmarks[1] = { x: 0.5, y: 0.45, z: 0 };
    landmarks[234] = { x: 0.22, y: 0.48, z: 0 };
    landmarks[454] = { x: 0.78, y: 0.5, z: 0 };
    landmarks[10] = { x: 0.5, y: 0.18, z: 0 };
    landmarks[152] = { x: 0.5, y: 0.82, z: 0 };

    const frame = buildGazeFrameFromLandmarks({
      landmarks,
      videoWidth: 1280,
      videoHeight: 720,
      viewportWidth: 1920,
      viewportHeight: 1080,
      timestamp: 123,
    });

    expect(frame.faceDetected).toBe(true);
    expect(frame.irisDetected).toBe(true);
    expect(frame.diagnostics.landmarksCount).toBe(478);
    expect(frame.diagnostics.faceBox).toEqual({
      x: expect.closeTo(281.6, 1),
      y: expect.closeTo(129.6, 1),
      width: expect.closeTo(716.8, 1),
      height: expect.closeTo(460.8, 1),
    });
    expect(frame.diagnostics.blink).toBe(false);
    expect(frame.features).toMatchObject({
      leftIrisX: expect.any(Number),
      rightIrisX: expect.any(Number),
      leftEyeOpen: expect.any(Number),
      rightEyeOpen: expect.any(Number),
    });
    expect(frame.rawPoint?.x).toBeGreaterThan(730);
    expect(frame.rawPoint?.x).toBeLessThan(920);
    expect(frame.rawPoint?.y).toBeGreaterThan(500);
    expect(frame.rawPoint?.y).toBeLessThan(640);
    expect(frame.confidence).toBeGreaterThan(0.75);
  });

  it("marks the frame as degraded when iris landmarks are missing", () => {
    const frame = buildGazeFrameFromLandmarks({
      landmarks: Array.from({ length: 468 }, () => ({ x: 0.5, y: 0.5, z: 0 })),
      videoWidth: 640,
      videoHeight: 480,
      viewportWidth: 1280,
      viewportHeight: 720,
      timestamp: 456,
    });

    expect(frame.faceDetected).toBe(true);
    expect(frame.irisDetected).toBe(false);
    expect(frame.rawPoint).toBeNull();
    expect(frame.point).toBeNull();
    expect(frame.confidence).toBe(0);
    expect(frame.diagnostics.blink).toBe(false);
  });

  it("flags blink-like frames when eyelid opening collapses", () => {
    const landmarks = createLandmarks();

    landmarks[33] = { x: 0.3, y: 0.4, z: 0 };
    landmarks[133] = { x: 0.4, y: 0.4, z: 0 };
    landmarks[159] = { x: 0.35, y: 0.399, z: 0 };
    landmarks[145] = { x: 0.35, y: 0.401, z: 0 };

    landmarks[362] = { x: 0.6, y: 0.4, z: 0 };
    landmarks[263] = { x: 0.7, y: 0.4, z: 0 };
    landmarks[386] = { x: 0.65, y: 0.399, z: 0 };
    landmarks[374] = { x: 0.65, y: 0.401, z: 0 };

    landmarks[468] = { x: 0.355, y: 0.4, z: 0 };
    landmarks[469] = { x: 0.357, y: 0.4, z: 0 };
    landmarks[470] = { x: 0.355, y: 0.401, z: 0 };
    landmarks[471] = { x: 0.353, y: 0.4, z: 0 };
    landmarks[472] = { x: 0.355, y: 0.399, z: 0 };
    landmarks[473] = { x: 0.652, y: 0.4, z: 0 };
    landmarks[474] = { x: 0.654, y: 0.4, z: 0 };
    landmarks[475] = { x: 0.652, y: 0.401, z: 0 };
    landmarks[476] = { x: 0.65, y: 0.4, z: 0 };
    landmarks[477] = { x: 0.652, y: 0.399, z: 0 };

    const frame = buildGazeFrameFromLandmarks({
      landmarks,
      videoWidth: 1280,
      videoHeight: 720,
      viewportWidth: 1280,
      viewportHeight: 720,
      timestamp: 789,
    });

    expect(frame.diagnostics.blink).toBe(true);
    expect(frame.confidence).toBeLessThan(0.5);
  });

  it("can disable pitch assistance to isolate iris-only vertical motion", () => {
    const withPitch = estimateRawScreenPoint(
      {
        leftIrisX: 0.5,
        leftIrisY: 0.56,
        rightIrisX: 0.5,
        rightIrisY: 0.56,
        leftEyeOpen: 0.2,
        rightEyeOpen: 0.2,
        interocularDistance: 0.28,
        faceCenterX: 0.5,
        faceCenterY: 0.5,
        faceWidth: 0.4,
        faceHeight: 0.55,
        yaw: 0,
        pitch: 0.25,
        roll: 0,
      },
      1000,
      1000,
      { usePitchAssist: true, pitchWeight: 0.4 },
    );

    const irisOnly = estimateRawScreenPoint(
      {
        leftIrisX: 0.5,
        leftIrisY: 0.56,
        rightIrisX: 0.5,
        rightIrisY: 0.56,
        leftEyeOpen: 0.2,
        rightEyeOpen: 0.2,
        interocularDistance: 0.28,
        faceCenterX: 0.5,
        faceCenterY: 0.5,
        faceWidth: 0.4,
        faceHeight: 0.55,
        yaw: 0,
        pitch: 0.25,
        roll: 0,
      },
      1000,
      1000,
      { usePitchAssist: false, pitchWeight: 0.4 },
    );

    expect(withPitch.y).toBeGreaterThan(irisOnly.y);
  });
});
