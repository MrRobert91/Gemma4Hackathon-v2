import type { CalibrationSampleV2, GazeFeatureVector, GazePoint } from "../types";

export type CalibrationModelV2 = {
  weightsX: number[];
  weightsY: number[];
  score: number;
  sampleCount: number;
};

const ridgeLambda = 0.01;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function createEmptyCalibrationModelV2(): CalibrationModelV2 {
  return {
    weightsX: [],
    weightsY: [],
    score: 0,
    sampleCount: 0,
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

export function applyCalibrationToFrame(features: GazeFeatureVector, model: CalibrationModelV2): GazePoint {
  return {
    x: predictWithWeights(model.weightsX, features),
    y: predictWithWeights(model.weightsY, features),
  };
}

export function buildCalibrationModelV2(samples: CalibrationSampleV2[]): CalibrationModelV2 {
  if (samples.length < 4) {
    return createEmptyCalibrationModelV2();
  }

  const weightsX = fitAxis(samples, "x");
  const weightsY = fitAxis(samples, "y");

  const meanAbsoluteError =
    samples.reduce((sum, sample) => {
      const predicted = applyCalibrationToFrame(sample.features, {
        weightsX,
        weightsY,
        score: 0,
        sampleCount: samples.length,
      });
      return sum + Math.abs(predicted.x - sample.target.x) + Math.abs(predicted.y - sample.target.y);
    }, 0) /
    (samples.length * 2);

  return {
    weightsX,
    weightsY,
    score: clamp(1 - meanAbsoluteError / 220, 0, 1),
    sampleCount: samples.length,
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
