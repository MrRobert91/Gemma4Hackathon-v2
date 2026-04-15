import type { FaceBox, GazeFeatureVector, GazeFrame, HeadPose, RawGazeMappingOptions } from "../types";

export type FaceLandmark = {
  x: number;
  y: number;
  z?: number;
};

type BuildGazeFrameOptions = {
  landmarks: FaceLandmark[];
  videoWidth: number;
  videoHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  timestamp: number;
  mappingOptions?: Partial<RawGazeMappingOptions>;
};

const defaultMappingOptions: RawGazeMappingOptions = {
  horizontalGain: 3.1,
  verticalGain: 2.4,
  yawWeight: 0.45,
  pitchWeight: 0.28,
  usePitchAssist: true,
  invertVertical: false,
};

const LEFT_EYE_OUTER = 33;
const LEFT_EYE_INNER = 133;
const LEFT_EYE_TOP = 159;
const LEFT_EYE_BOTTOM = 145;

const RIGHT_EYE_INNER = 362;
const RIGHT_EYE_OUTER = 263;
const RIGHT_EYE_TOP = 386;
const RIGHT_EYE_BOTTOM = 374;

const LEFT_IRIS = [468, 469, 470, 471, 472];
const RIGHT_IRIS = [473, 474, 475, 476, 477];

const FACE_LEFT = 234;
const FACE_RIGHT = 454;
const FACE_TOP = 10;
const FACE_BOTTOM = 152;
const NOSE_TIP = 1;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getLandmark(landmarks: FaceLandmark[], index: number) {
  return landmarks[index] ?? null;
}

function averageLandmarks(landmarks: FaceLandmark[], indices: number[]) {
  const points = indices.map((index) => getLandmark(landmarks, index)).filter(Boolean) as FaceLandmark[];
  if (points.length !== indices.length) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
    z: points.reduce((sum, point) => sum + (point.z ?? 0), 0) / points.length,
  };
}

function buildFaceBox(landmarks: FaceLandmark[], videoWidth: number, videoHeight: number): FaceBox | undefined {
  if (landmarks.length === 0) {
    return undefined;
  }

  const xs = landmarks.map((landmark) => landmark.x);
  const ys = landmarks.map((landmark) => landmark.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: minX * videoWidth,
    y: minY * videoHeight,
    width: Math.max(0, (maxX - minX) * videoWidth),
    height: Math.max(0, (maxY - minY) * videoHeight),
  };
}

function computeHeadPose(landmarks: FaceLandmark[]): HeadPose | null {
  const left = getLandmark(landmarks, FACE_LEFT);
  const right = getLandmark(landmarks, FACE_RIGHT);
  const top = getLandmark(landmarks, FACE_TOP);
  const bottom = getLandmark(landmarks, FACE_BOTTOM);
  const nose = getLandmark(landmarks, NOSE_TIP);
  if (!left || !right || !top || !bottom || !nose) {
    return null;
  }

  const faceWidth = Math.max(0.0001, right.x - left.x);
  const faceHeight = Math.max(0.0001, bottom.y - top.y);
  const midX = (left.x + right.x) / 2;
  const midY = (top.y + bottom.y) / 2;

  return {
    yaw: clamp((nose.x - midX) / faceWidth, -1, 1),
    pitch: clamp((nose.y - midY) / faceHeight, -1, 1),
    roll: clamp((right.y - left.y) / faceWidth, -1, 1),
  };
}

function toEyeRatio(iris: FaceLandmark, start: FaceLandmark, end: FaceLandmark) {
  const width = Math.max(0.0001, end.x - start.x);
  return clamp((iris.x - start.x) / width, 0, 1);
}

function toVerticalEyeRatio(iris: FaceLandmark, top: FaceLandmark, bottom: FaceLandmark) {
  const height = Math.max(0.0001, bottom.y - top.y);
  return clamp((iris.y - top.y) / height, 0, 1);
}

function toEyeOpen(top: FaceLandmark, bottom: FaceLandmark, start: FaceLandmark, end: FaceLandmark) {
  const width = Math.max(0.0001, end.x - start.x);
  return Math.abs(bottom.y - top.y) / width;
}

function buildFeatureVector(landmarks: FaceLandmark[]): { features: GazeFeatureVector | null; blink: boolean } {
  const leftOuter = getLandmark(landmarks, LEFT_EYE_OUTER);
  const leftInner = getLandmark(landmarks, LEFT_EYE_INNER);
  const leftTop = getLandmark(landmarks, LEFT_EYE_TOP);
  const leftBottom = getLandmark(landmarks, LEFT_EYE_BOTTOM);

  const rightInner = getLandmark(landmarks, RIGHT_EYE_INNER);
  const rightOuter = getLandmark(landmarks, RIGHT_EYE_OUTER);
  const rightTop = getLandmark(landmarks, RIGHT_EYE_TOP);
  const rightBottom = getLandmark(landmarks, RIGHT_EYE_BOTTOM);

  const leftIris = averageLandmarks(landmarks, LEFT_IRIS);
  const rightIris = averageLandmarks(landmarks, RIGHT_IRIS);
  const headPose = computeHeadPose(landmarks);
  const faceBox = buildFaceBox(landmarks, 1, 1);

  if (
    !leftOuter ||
    !leftInner ||
    !leftTop ||
    !leftBottom ||
    !rightInner ||
    !rightOuter ||
    !rightTop ||
    !rightBottom ||
    !leftIris ||
    !rightIris ||
    !headPose ||
    !faceBox
  ) {
    return {
      features: null,
      blink: false,
    };
  }

  const leftEyeOpen = toEyeOpen(leftTop, leftBottom, leftOuter, leftInner);
  const rightEyeOpen = toEyeOpen(rightTop, rightBottom, rightInner, rightOuter);
  const blink = leftEyeOpen < 0.06 || rightEyeOpen < 0.06;

  return {
    features: {
      leftIrisX: toEyeRatio(leftIris, leftOuter, leftInner),
      leftIrisY: toVerticalEyeRatio(leftIris, leftTop, leftBottom),
      rightIrisX: toEyeRatio(rightIris, rightInner, rightOuter),
      rightIrisY: toVerticalEyeRatio(rightIris, rightTop, rightBottom),
      leftEyeOpen,
      rightEyeOpen,
      interocularDistance: Math.abs(rightIris.x - leftIris.x),
      faceCenterX: faceBox.x + faceBox.width / 2,
      faceCenterY: faceBox.y + faceBox.height / 2,
      faceWidth: faceBox.width,
      faceHeight: faceBox.height,
      yaw: headPose.yaw,
      pitch: headPose.pitch,
      roll: headPose.roll,
    },
    blink,
  };
}

export function estimateRawScreenPoint(
  features: GazeFeatureVector,
  viewportWidth: number,
  viewportHeight: number,
  options?: Partial<RawGazeMappingOptions>,
) {
  const mapping = { ...defaultMappingOptions, ...options };
  const horizontalSignal = ((features.leftIrisX - 0.5) + (features.rightIrisX - 0.5)) / 2;
  const verticalSignal = ((features.leftIrisY - 0.5) + (features.rightIrisY - 0.5)) / 2;
  const verticalDirection = mapping.invertVertical ? -1 : 1;
  const horizontal = clamp(
    0.5 - horizontalSignal * mapping.horizontalGain - features.yaw * mapping.yawWeight,
    0,
    1,
  );
  const vertical = clamp(
    0.5 +
      verticalSignal * mapping.verticalGain * verticalDirection +
      (mapping.usePitchAssist ? features.pitch * mapping.pitchWeight * verticalDirection : 0),
    0,
    1,
  );

  return {
    x: horizontal * viewportWidth,
    y: vertical * viewportHeight,
  };
}

export function buildGazeFrameFromLandmarks({
  landmarks,
  videoWidth,
  videoHeight,
  viewportWidth,
  viewportHeight,
  timestamp,
  mappingOptions,
}: BuildGazeFrameOptions): GazeFrame {
  const faceDetected = landmarks.length > 0;
  const diagnostics = {
    landmarksCount: landmarks.length,
    blink: false,
    faceBox: buildFaceBox(landmarks, videoWidth, videoHeight),
  };

  if (!faceDetected) {
    return {
      timestamp,
      point: null,
      rawPoint: null,
      confidence: 0,
      faceDetected: false,
      irisDetected: false,
      headPose: null,
      diagnostics,
      features: null,
    };
  }

  const { features, blink } = buildFeatureVector(landmarks);
  diagnostics.blink = blink;

  if (!features) {
    return {
      timestamp,
      point: null,
      rawPoint: null,
      confidence: 0,
      faceDetected: true,
      irisDetected: false,
      headPose: computeHeadPose(landmarks),
      diagnostics,
      features: null,
    };
  }

  const faceScalePenalty = diagnostics.faceBox && diagnostics.faceBox.width > videoWidth * 0.12 ? 0 : 0.2;
  const blinkPenalty = blink ? 0.55 : 0;
  const rollPenalty = Math.min(Math.abs(features.roll) * 0.25, 0.15);
  const confidence = clamp(1 - faceScalePenalty - blinkPenalty - rollPenalty, 0, 1);
  const rawPoint =
    confidence > 0 ? estimateRawScreenPoint(features, viewportWidth, viewportHeight, mappingOptions) : null;

  return {
    timestamp,
    point: rawPoint,
    rawPoint,
    confidence,
    faceDetected: true,
    irisDetected: true,
    headPose: {
      yaw: features.yaw,
      pitch: features.pitch,
      roll: features.roll,
    },
    diagnostics,
    features,
  };
}
