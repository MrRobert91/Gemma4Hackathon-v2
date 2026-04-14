import base64

from app.services.tts import MockTTSProvider, TTSRequest


def test_mock_tts_provider_returns_playable_audio_payload():
    provider = MockTTSProvider()

    result = provider.synthesize(TTSRequest(text="Necesito ayuda", language="es-ES"))

    assert result.mime_type == "audio/wav"
    decoded = base64.b64decode(result.audio_base64.encode("utf-8"))
    assert len(decoded) > 32
    assert decoded[:4] == b"RIFF"
