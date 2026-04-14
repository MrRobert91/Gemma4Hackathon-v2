import type { GazeFrame } from "../types";
import type { FaceLandmark } from "./gazeFeatures";

export function mirrorPreviewX(normalizedX: number, width: number) {
  return (1 - normalizedX) * width;
}

export function mirrorPreviewBox(
  box: NonNullable<GazeFrame["diagnostics"]["faceBox"]>,
  canvasWidth: number,
) {
  return {
    x: canvasWidth - box.x - box.width,
    y: box.y,
    width: box.width,
    height: box.height,
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function drawCrosshair(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  radius = 10,
) {
  context.save();
  context.strokeStyle = color;
  context.lineWidth = 2;
  context.beginPath();
  context.arc(x, y, radius, 0, Math.PI * 2);
  context.stroke();
  context.beginPath();
  context.moveTo(x - radius - 6, y);
  context.lineTo(x + radius + 6, y);
  context.moveTo(x, y - radius - 6);
  context.lineTo(x, y + radius + 6);
  context.stroke();
  context.restore();
}

export function drawGazeOverlay(
  canvas: HTMLCanvasElement,
  landmarks: FaceLandmark[],
  frame: GazeFrame,
  videoWidth: number,
  videoHeight: number,
) {
  const context = canvas.getContext("2d");
  if (!context) {
    return;
  }

  if (canvas.width !== videoWidth || canvas.height !== videoHeight) {
    canvas.width = videoWidth;
    canvas.height = videoHeight;
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgba(3, 8, 10, 0.22)";
  context.fillRect(0, 0, canvas.width, canvas.height);

  if (landmarks.length > 0) {
    context.save();
    context.fillStyle = "rgba(142, 246, 202, 0.8)";
    for (let index = 0; index < landmarks.length; index += 8) {
      const point = landmarks[index];
      const x = mirrorPreviewX(point.x, canvas.width);
      const y = point.y * canvas.height;
      context.beginPath();
      context.arc(x, y, 1.6, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
  }

  const irisIndices = [468, 469, 470, 471, 472, 473, 474, 475, 476, 477];
  context.save();
  context.fillStyle = "#ffd86b";
  irisIndices.forEach((index) => {
    const point = landmarks[index];
    if (!point) {
      return;
    }
    context.beginPath();
    context.arc(mirrorPreviewX(point.x, canvas.width), point.y * canvas.height, 3.2, 0, Math.PI * 2);
    context.fill();
  });
  context.restore();

  if (frame.diagnostics.faceBox) {
    const previewBox = mirrorPreviewBox(frame.diagnostics.faceBox, canvas.width);
    context.save();
    context.strokeStyle = frame.irisDetected ? "#8ef6ca" : "#ff9b42";
    context.lineWidth = 2;
    context.strokeRect(
      previewBox.x,
      previewBox.y,
      previewBox.width,
      previewBox.height,
    );
    context.restore();
  }

  if (frame.features && frame.diagnostics.faceBox) {
    const centerX = clamp(mirrorPreviewX(frame.features.faceCenterX, canvas.width), 0, canvas.width);
    const centerY = clamp(frame.features.faceCenterY * canvas.height, 0, canvas.height);
    drawCrosshair(context, centerX, centerY, "#8ef6ca", 8);
  }

  context.save();
  context.fillStyle = "rgba(4, 10, 12, 0.72)";
  context.fillRect(10, 10, 210, 74);
  context.fillStyle = "#f6f4ea";
  context.font = "12px Space Grotesk, sans-serif";
  context.fillText(`landmarks: ${frame.diagnostics.landmarksCount}`, 18, 28);
  context.fillText(`iris: ${frame.irisDetected ? "ok" : "no"}`, 18, 46);
  context.fillText(`confianza: ${Math.round(frame.confidence * 100)}%`, 18, 64);
  context.restore();
}
