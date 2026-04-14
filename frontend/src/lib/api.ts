import type { PredictionResponse, ProfilePreferences, TTSResponse, UserProfile } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function fetchPredictions(text: string, userId = "demo-user"): Promise<PredictionResponse> {
  const response = await fetch(`${apiBaseUrl}/api/predict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      user_id: userId,
      text,
      language: "es",
    }),
  });
  return parseJson<PredictionResponse>(response);
}

export async function startSession(userId = "demo-user"): Promise<{ session_id: string }> {
  const response = await fetch(`${apiBaseUrl}/api/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  return parseJson<{ session_id: string }>(response);
}

export async function updateSessionText(sessionId: string, text: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/text`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });
}

export async function commitSessionPhrase(sessionId: string, phrase: string): Promise<void> {
  await fetch(`${apiBaseUrl}/api/sessions/${sessionId}/commit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ phrase }),
  });
}

export async function requestSpeech(text: string): Promise<TTSResponse> {
  const response = await fetch(`${apiBaseUrl}/api/tts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text,
      language: "es-ES",
      voice: "default",
    }),
  });
  return parseJson<TTSResponse>(response);
}

export async function fetchProfile(userId = "demo-user"): Promise<UserProfile> {
  const response = await fetch(`${apiBaseUrl}/api/profiles/${userId}`);
  return parseJson<UserProfile>(response);
}

export async function updateProfile(userId: string, preferences: ProfilePreferences): Promise<UserProfile> {
  const response = await fetch(`${apiBaseUrl}/api/profiles/${userId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(preferences),
  });
  return parseJson<UserProfile>(response);
}
