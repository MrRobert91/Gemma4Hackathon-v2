import type { GoogleFormSubmitResponse, ImportedForm } from "../types";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "";

async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  return (await response.json()) as T;
}

export async function importGoogleForm(url: string): Promise<ImportedForm> {
  const response = await fetch(`${apiBaseUrl}/api/google-forms/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
  });
  return parseJson<ImportedForm>(response);
}

export async function submitGoogleForm(url: string, answers: Record<string, string[]>): Promise<GoogleFormSubmitResponse> {
  const response = await fetch(`${apiBaseUrl}/api/google-forms/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url, answers }),
  });
  return parseJson<GoogleFormSubmitResponse>(response);
}
