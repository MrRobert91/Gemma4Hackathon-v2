from fastapi.testclient import TestClient

from app.main import create_app
from app.services.gemma import BaseGemmaReranker, NoopGemmaReranker, RerankRequest


class FixedReranker(BaseGemmaReranker):
    provider_name = "fixed"
    model_name = "fixed-model"

    def rerank(self, request: RerankRequest) -> list[str]:
        return list(reversed(request.candidates))


def test_predict_endpoint_returns_ranked_suggestions():
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post(
        "/api/predict",
        json={"user_id": "demo", "text": "quiero a", "language": "es"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "suggestions" in payload
    assert payload["suggestions"][0]["text"] == "agua"


def test_tts_endpoint_returns_mock_audio():
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))

    response = client.post(
        "/api/tts",
        json={"text": "Hola", "language": "es-ES", "voice": "default"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mime_type"] == "audio/wav"
    assert payload["audio_base64"]


def test_profile_endpoint_persists_preferences():
    client = TestClient(create_app(gemma_reranker=NoopGemmaReranker()))
    user_id = "demo-profile-test"

    update_response = client.put(
        f"/api/profiles/{user_id}",
        json={"language": "es", "dwell_ms": 950, "high_contrast": True},
    )
    assert update_response.status_code == 200

    read_response = client.get(f"/api/profiles/{user_id}")
    assert read_response.status_code == 200
    payload = read_response.json()
    assert payload["preferences"]["dwell_ms"] == 950
    assert payload["preferences"]["high_contrast"] is True


def test_gemma_rerank_endpoint_returns_proxy_response():
    client = TestClient(create_app(gemma_reranker=FixedReranker()))

    response = client.post(
        "/api/gemma/rerank",
        json={
            "user_id": "demo",
            "language": "es",
            "context": "quiero a",
            "candidates": ["agua", "ahora", "ayuda"],
        },
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["provider"] == "fixed"
    assert payload["model"] == "fixed-model"
    assert payload["ordered_candidates"] == ["ayuda", "ahora", "agua"]
