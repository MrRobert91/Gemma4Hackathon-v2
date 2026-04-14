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
