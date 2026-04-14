from __future__ import annotations

import json
import os
from functools import cached_property

import httpx
from pydantic import BaseModel


class RerankRequest(BaseModel):
    user_id: str
    language: str
    context: str
    candidates: list[str]


class BaseGemmaReranker:
    provider_name = "base"
    model_name = "none"

    def rerank(self, request: RerankRequest) -> list[str]:
        raise NotImplementedError


class NoopGemmaReranker(BaseGemmaReranker):
    provider_name = "none"
    model_name = "none"

    def rerank(self, request: RerankRequest) -> list[str]:
        return request.candidates


class RerankResponse(BaseModel):
    ordered_candidates: list[str]
    provider: str
    model: str


class OpenAICompatibleGemmaReranker(BaseGemmaReranker):
    provider_name = "openai_compat"

    def __init__(self, base_url: str, api_key: str, model: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._model = model
        self.model_name = model

    def rerank(self, request: RerankRequest) -> list[str]:
        prompt = (
            "Reordena esta lista de candidatas para predicción AAC.\n"
            "Devuelve SOLO un JSON array con las mismas cadenas, sin añadir nuevas.\n"
            f"Idioma: {request.language}\n"
            f"Contexto: {request.context}\n"
            f"Candidatas: {json.dumps(request.candidates, ensure_ascii=False)}"
        )
        response = httpx.post(
            f"{self._base_url}/chat/completions",
            headers={"Authorization": f"Bearer {self._api_key}"},
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": "Eres un reranker preciso para un teclado AAC."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
            },
            timeout=20,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return request.candidates
        return [item for item in parsed if item in request.candidates]


class OpenRouterGemmaReranker(OpenAICompatibleGemmaReranker):
    provider_name = "openrouter"

    def __init__(self, api_key: str, model: str) -> None:
        super().__init__(
            base_url="https://openrouter.ai/api/v1",
            api_key=api_key,
            model=model,
        )

    def rerank(self, request: RerankRequest) -> list[str]:
        prompt = (
            "Reordena esta lista de candidatas para predicción AAC.\n"
            "Devuelve SOLO un JSON array con las mismas cadenas, sin añadir nuevas.\n"
            f"Idioma: {request.language}\n"
            f"Contexto: {request.context}\n"
            f"Candidatas: {json.dumps(request.candidates, ensure_ascii=False)}"
        )
        response = httpx.post(
            f"{self._base_url}/chat/completions",
            headers={
                "Authorization": f"Bearer {self._api_key}",
                "HTTP-Referer": os.getenv("OPENROUTER_SITE_URL", "http://localhost:3000"),
                "X-Title": os.getenv("OPENROUTER_APP_NAME", "EyeSpeak Gemma"),
            },
            json={
                "model": self._model,
                "messages": [
                    {"role": "system", "content": "Eres un reranker preciso para un teclado AAC."},
                    {"role": "user", "content": prompt},
                ],
                "temperature": 0,
            },
            timeout=20,
        )
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        try:
            parsed = json.loads(content)
        except json.JSONDecodeError:
            return request.candidates
        return [item for item in parsed if item in request.candidates]


class TransformersGemmaReranker(BaseGemmaReranker):
    provider_name = "transformers"

    def __init__(self, model_id: str) -> None:
        self._model_id = model_id
        self.model_name = model_id

    @cached_property
    def _pipeline(self):
        from transformers import pipeline

        return pipeline(
            "text-generation",
            model=self._model_id,
            device_map="auto",
            token=os.getenv("HF_TOKEN"),
        )

    def rerank(self, request: RerankRequest) -> list[str]:
        prompt = (
            "Reordena para un teclado AAC la lista de palabras candidatas.\n"
            "Devuelve SOLO JSON con el array ordenado y las mismas palabras.\n"
            f"Idioma: {request.language}\n"
            f"Contexto: {request.context}\n"
            f"Candidatas: {json.dumps(request.candidates, ensure_ascii=False)}"
        )
        output = self._pipeline(prompt, max_new_tokens=80, do_sample=False)[0]["generated_text"]
        suffix = output[len(prompt):].strip() if output.startswith(prompt) else output.strip()
        start = suffix.find("[")
        end = suffix.rfind("]")
        if start == -1 or end == -1:
            return request.candidates
        try:
            parsed = json.loads(suffix[start : end + 1])
        except json.JSONDecodeError:
            return request.candidates
        return [item for item in parsed if item in request.candidates]


class GoogleAIRestGemmaReranker(BaseGemmaReranker):
    provider_name = "google_ai_rest"

    def __init__(self, api_key: str, model: str) -> None:
        self._api_key = api_key
        self._model = model
        self.model_name = model

    def rerank(self, request: RerankRequest) -> list[str]:
        prompt = (
            "Reordena para un teclado AAC la lista de palabras candidatas.\n"
            "Devuelve SOLO un JSON array con el mismo contenido y sin texto adicional.\n"
            f"Idioma: {request.language}\n"
            f"Contexto: {request.context}\n"
            f"Candidatas: {json.dumps(request.candidates, ensure_ascii=False)}"
        )
        response = httpx.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{self._model}:generateContent",
            params={"key": self._api_key},
            json={
                "contents": [{"parts": [{"text": prompt}]}],
                "generationConfig": {"temperature": 0},
            },
            timeout=20,
        )
        response.raise_for_status()
        payload = response.json()
        text = payload["candidates"][0]["content"]["parts"][0]["text"]
        try:
            parsed = json.loads(text)
        except json.JSONDecodeError:
            return request.candidates
        return [item for item in parsed if item in request.candidates]


def build_gemma_reranker() -> BaseGemmaReranker:
    provider = os.getenv("GEMMA_PROVIDER", "none").lower()
    if provider == "openrouter":
        return OpenRouterGemmaReranker(
            api_key=os.getenv("OPENROUTER_API_KEY", ""),
            model=os.getenv("OPENROUTER_MODEL_ID", "google/gemma-4-26b-a4b-it:free"),
        )
    if provider == "openai_compat":
        return OpenAICompatibleGemmaReranker(
            base_url=os.getenv("GEMMA_BASE_URL", "http://localhost:11434/v1"),
            api_key=os.getenv("GEMMA_API_KEY", "unused"),
            model=os.getenv("GEMMA_MODEL_ID", "google/gemma-4-E4B-it"),
        )
    if provider == "transformers":
        return TransformersGemmaReranker(
            model_id=os.getenv("GEMMA_MODEL_ID", "google/gemma-4-E4B-it")
        )
    return NoopGemmaReranker()
