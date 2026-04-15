export type SuggestionItem = {
  text: string;
  source: string;
  score: number;
};

export type PredictionResponse = {
  suggestions: SuggestionItem[];
  quick_phrases: SuggestionItem[];
};

export type TTSResponse = {
  mime_type: string;
  audio_base64: string;
  provider: string;
};

export type ProfilePreferences = {
  language: string;
  dwell_ms: number;
  high_contrast: boolean;
};

export type UserProfile = {
  user_id: string;
  preferences: ProfilePreferences;
  quick_phrases: string[];
};

export type GazePoint = {
  x: number;
  y: number;
};

export type HeadPose = {
  yaw: number;
  pitch: number;
  roll: number;
};

export type FaceBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type GazeProviderStatus =
  | "idle"
  | "loading"
  | "camera_ready"
  | "tracking"
  | "calibrating"
  | "ready"
  | "degraded"
  | "failed";

export type GazeFeatureVector = {
  leftIrisX: number;
  leftIrisY: number;
  rightIrisX: number;
  rightIrisY: number;
  leftEyeOpen: number;
  rightEyeOpen: number;
  interocularDistance: number;
  faceCenterX: number;
  faceCenterY: number;
  faceWidth: number;
  faceHeight: number;
  yaw: number;
  pitch: number;
  roll: number;
};

export type GazeDiagnostics = {
  landmarksCount: number;
  blink: boolean;
  faceBox?: FaceBox;
};

export type GazeFrame = {
  timestamp: number;
  point: GazePoint | null;
  rawPoint: GazePoint | null;
  confidence: number;
  faceDetected: boolean;
  irisDetected: boolean;
  headPose: HeadPose | null;
  diagnostics: GazeDiagnostics;
  features: GazeFeatureVector | null;
};

export type CalibrationSampleV2 = {
  features: GazeFeatureVector;
  target: GazePoint;
  quality: number;
};

export type RawGazeMappingOptions = {
  horizontalGain: number;
  verticalGain: number;
  yawWeight: number;
  pitchWeight: number;
  usePitchAssist: boolean;
};
