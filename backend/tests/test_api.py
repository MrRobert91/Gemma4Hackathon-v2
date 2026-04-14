from fastapi.testclient import TestClient

from app.main import create_app


def test_predict_endpoint_returns_ranked_suggestions():
    client = TestClient(create_app())

    response = client.post(
        "/api/predict",
        json={"user_id": "demo", "text": "quiero a", "language": "es"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert "suggestions" in payload
    assert payload["suggestions"][0]["text"] == "agua"


def test_tts_endpoint_returns_mock_audio():
    client = TestClient(create_app())

    response = client.post(
        "/api/tts",
        json={"text": "Hola", "language": "es-ES", "voice": "default"},
    )

    assert response.status_code == 200
    payload = response.json()
    assert payload["mime_type"] == "audio/wav"
    assert payload["audio_base64"]


def test_profile_endpoint_persists_preferences():
    client = TestClient(create_app())
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
