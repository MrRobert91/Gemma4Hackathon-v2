import type { CalibrationSampleV2, GazeFeatureVector, GazePoint } from "../types";

export type AxisRangeCalibration = {
  observedMin: number;
  observedMax: number;
  targetMin: number;
  targetMax: number;
  invert: boolean;
};

export type CalibrationApplicationOptions = {
  horizontalSensitivity?: number;
  verticalSensitivity?: number;
};

export type CalibrationModelV2 = {
  weightsX: number[];
  weightsY: number[];
  score: number;
  sampleCount: number;
  axisRangeX: AxisRangeCalibration | null;
  axisRangeY: AxisRangeCalibration | null;
};

const ridgeLambda = 0.01;
const calibrationEdgeExpansionFactor = 0.125;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createEmptyCalibrationModelV2(): CalibrationModelV2 {
  return {
    weightsX: [],
    weightsY: [],
    score: 0,
    sampleCount: 0,
    axisRangeX: null,
    axisRangeY: null,
  };
}

export function featureVectorToArray(features: GazeFeatureVector) {
  return [
    1,
    features.leftIrisX,
    features.leftIrisY,
    features.rightIrisX,
    features.rightIrisY,
    features.leftEyeOpen,
    features.rightEyeOpen,
    features.interocularDistance,
    features.faceCenterX,
    features.faceCenterY,
    features.faceWidth,
    features.faceHeight,
    features.yaw,
    features.pitch,
    features.roll,
  ];
}

function solveLinearSystem(matrix: number[][], vector: number[]) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);

  for (let pivot = 0; pivot < size; pivot += 1) {
    let maxRow = pivot;
    for (let row = pivot + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][pivot]) > Math.abs(augmented[maxRow][pivot])) {
        maxRow = row;
      }
    }

    if (Math.abs(augmented[maxRow][pivot]) < 1e-10) {
      continue;
    }

    [augmented[pivot], augmented[maxRow]] = [augmented[maxRow], augmented[pivot]];

    const divisor = augmented[pivot][pivot];
    for (let column = pivot; column <= size; column += 1) {
      augmented[pivot][column] /= divisor;
    }

    for (let row = 0; row < size; row += 1) {
      if (row === pivot) {
        continue;
      }
      const factor = augmented[row][pivot];
      for (let column = pivot; column <= size; column += 1) {
        augmented[row][column] -= factor * augmented[pivot][column];
      }
    }
  }

  return augmented.map((row) => row[size] ?? 0);
}

function fitAxis(samples: CalibrationSampleV2[], targetKey: "x" | "y") {
  if (samples.length < 4) {
    return [];
  }

  const rows = samples.map((sample) => featureVectorToArray(sample.features));
  const cols = rows[0]?.length ?? 0;
  const xtx = Array.from({ length: cols }, () => Array.from({ length: cols }, () => 0));
  const xty = Array.from({ length: cols }, () => 0);

  for (let sampleIndex = 0; sampleIndex < rows.length; sampleIndex += 1) {
    const row = rows[sampleIndex];
    const weight = clamp(samples[sampleIndex].quality, 0.01, 1);
    for (let i = 0; i < cols; i += 1) {
      xty[i] += row[i] * samples[sampleIndex].target[targetKey] * weight;
      for (let j = 0; j < cols; j += 1) {
        xtx[i][j] += row[i] * row[j] * weight;
      }
    }
  }

  for (let diagonal = 0; diagonal < cols; diagonal += 1) {
    xtx[diagonal][diagonal] += ridgeLambda;
  }

  return solveLinearSystem(xtx, xty);
}

function predictWithWeights(weights: number[], features: GazeFeatureVector) {
  if (weights.length === 0) {
    return 0;
  }

  const featureArray = featureVectorToArray(features);
  return featureArray.reduce((sum, value, index) => sum + value * (weights[index] ?? 0), 0);
}

function average(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function buildExpandedTargetBounds(targetMin: number, targetMax: number) {
  const span = targetMax - targetMin;
  const padding = span * calibrationEdgeExpansionFactor;

  return {
    targetMin: targetMin - padding,
    targetMax: targetMax + padding,
  };
}

function buildAxisRangeCalibration(samples: CalibrationSampleV2[], weights: number[], targetKey: "x" | "y") {
  if (samples.length < 4 || weights.length === 0) {
    return null;
  }

  const targetValues = samples.map((sample) => sample.target[targetKey]);
  const targetMin = Math.min(...targetValues);
  const targetMax = Math.max(...targetValues);
  const lowEdgeSamples = samples.filter((sample) => Math.abs(sample.target[targetKey] - targetMin) < 1e-3);
  const highEdgeSamples = samples.filter((sample) => Math.abs(sample.target[targetKey] - targetMax) < 1e-3);

  if (lowEdgeSamples.length === 0 || highEdgeSamples.length === 0 || Math.abs(targetMax - targetMin) < 1e-6) {
    return null;
  }

  const observedLow = average(lowEdgeSamples.map((sample) => predictWithWeights(weights, sample.features)));
  const observedHigh = average(highEdgeSamples.map((sample) => predictWithWeights(weights, sample.features)));
  const observedMin = Math.min(observedLow, observedHigh);
  const observedMax = Math.max(observedLow, observedHigh);

  if (Math.abs(observedMax - observedMin) < 1e-6) {
    return null;
  }

  const expandedTargets = buildExpandedTargetBounds(targetMin, targetMax);

  return {
    observedMin,
    observedMax,
    targetMin: expandedTargets.targetMin,
    targetMax: expandedTargets.targetMax,
    invert: observedLow > observedHigh,
  };
}

function applyAxisRange(value: number, axisRange: AxisRangeCalibration | null, sensitivity = 1) {
  if (!axisRange) {
    return value;
  }

  const observedSpan = axisRange.observedMax - axisRange.observedMin;
  if (Math.abs(observedSpan) < 1e-6) {
    return clamp(value, axisRange.targetMin, axisRange.targetMax);
  }

  let normalized = clamp((value - axisRange.observedMin) / observedSpan, 0, 1);
  if (axisRange.invert) {
    normalized = 1 - normalized;
  }
  const remapped = axisRange.targetMin + normalized * (axisRange.targetMax - axisRange.targetMin);
  const center = (axisRange.targetMin + axisRange.targetMax) / 2;
  const boosted = center + (remapped - center) * sensitivity;

  return clamp(boosted, axisRange.targetMin, axisRange.targetMax);
}

export function expandPointWithAxisRanges(
  point: GazePoint,
  model: CalibrationModelV2,
  options?: CalibrationApplicationOptions,
): GazePoint {
  return {
    x: applyAxisRange(point.x, model.axisRangeX, options?.horizontalSensitivity ?? 1),
    y: applyAxisRange(point.y, model.axisRangeY, options?.verticalSensitivity ?? 1),
  };
}

export function applyCalibrationToFrame(
  features: GazeFeatureVector,
  model: CalibrationModelV2,
  options?: CalibrationApplicationOptions,
): GazePoint {
  const basePoint = {
    x: predictWithWeights(model.weightsX, features),
    y: predictWithWeights(model.weightsY, features),
  };

  return {
    ...expandPointWithAxisRanges(basePoint, model, options),
  };
}

export function buildCalibrationModelV2(samples: CalibrationSampleV2[]): CalibrationModelV2 {
  if (samples.length < 4) {
    return createEmptyCalibrationModelV2();
  }

  const weightsX = fitAxis(samples, "x");
  const weightsY = fitAxis(samples, "y");
  const axisRangeX = buildAxisRangeCalibration(samples, weightsX, "x");
  const axisRangeY = buildAxisRangeCalibration(samples, weightsY, "y");

  const meanAbsoluteError =
    samples.reduce((sum, sample) => {
      const predicted = applyCalibrationToFrame(sample.features, {
        weightsX,
        weightsY,
        score: 0,
        sampleCount: samples.length,
        axisRangeX,
        axisRangeY,
      });
      return sum + Math.abs(predicted.x - sample.target.x) + Math.abs(predicted.y - sample.target.y);
    }, 0) /
    (samples.length * 2);

  return {
    weightsX,
    weightsY,
    score: clamp(1 - meanAbsoluteError / 220, 0, 1),
    sampleCount: samples.length,
    axisRangeX,
    axisRangeY,
  };
}

export function isCalibrationWindowStable(points: GazePoint[], maxDistance: number) {
  if (points.length < 3) {
    return false;
  }

  const center = {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };

  return points.every((point) => Math.hypot(point.x - center.x, point.y - center.y) <= maxDistance);
}

function featureDistance(a: GazeFeatureVector, b: GazeFeatureVector) {
  return Math.hypot(
    (a.leftIrisX - b.leftIrisX) * 2.4,
    (a.leftIrisY - b.leftIrisY) * 2.4,
    (a.rightIrisX - b.rightIrisX) * 2.4,
    (a.rightIrisY - b.rightIrisY) * 2.4,
    (a.yaw - b.yaw) * 1.2,
    (a.pitch - b.pitch) * 1.2,
  );
}

export function isFeatureWindowStable(vectors: GazeFeatureVector[], maxDistance: number) {
  if (vectors.length < 4) {
    return false;
  }

  const center = averageFeatureVectors(vectors);
  if (!center) {
    return false;
  }

  return vectors.every((vector) => featureDistance(vector, center) <= maxDistance);
}

export function averageFeatureVectors(vectors: GazeFeatureVector[]) {
  if (vectors.length === 0) {
    return null;
  }

  const totals = vectors.reduce<Record<keyof GazeFeatureVector, number>>(
    (accumulator, vector) => {
      for (const [key, value] of Object.entries(vector) as Array<[keyof GazeFeatureVector, number]>) {
        accumulator[key] += value;
      }
      return accumulator;
    },
    {
      leftIrisX: 0,
      leftIrisY: 0,
      rightIrisX: 0,
      rightIrisY: 0,
      leftEyeOpen: 0,
      rightEyeOpen: 0,
      interocularDistance: 0,
      faceCenterX: 0,
      faceCenterY: 0,
      faceWidth: 0,
      faceHeight: 0,
      yaw: 0,
      pitch: 0,
      roll: 0,
    },
  );

  const count = vectors.length;
  return {
    leftIrisX: totals.leftIrisX / count,
    leftIrisY: totals.leftIrisY / count,
    rightIrisX: totals.rightIrisX / count,
    rightIrisY: totals.rightIrisY / count,
    leftEyeOpen: totals.leftEyeOpen / count,
    rightEyeOpen: totals.rightEyeOpen / count,
    interocularDistance: totals.interocularDistance / count,
    faceCenterX: totals.faceCenterX / count,
    faceCenterY: totals.faceCenterY / count,
    faceWidth: totals.faceWidth / count,
    faceHeight: totals.faceHeight / count,
    yaw: totals.yaw / count,
    pitch: totals.pitch / count,
    roll: totals.roll / count,
  };
}
