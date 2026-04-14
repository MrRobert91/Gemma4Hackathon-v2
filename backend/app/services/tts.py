from __future__ import annotations

import base64
from io import BytesIO
import math
import os
import wave

from pydantic import BaseModel

try:
    from google.cloud import texttospeech
except Exception:  # pragma: no cover
    texttospeech = None


class TTSRequest(BaseModel):
    text: str
    language: str = "es-ES"
    voice: str = "default"


class TTSResult(BaseModel):
    mime_type: str
    audio_base64: str
    provider: str


class BaseTTSProvider:
    provider_name = "base"

    def synthesize(self, request: TTSRequest) -> TTSResult:
        raise NotImplementedError


class MockTTSProvider(BaseTTSProvider):
    provider_name = "mock"

    def synthesize(self, request: TTSRequest) -> TTSResult:
        payload = self._generate_wave_bytes(request.text)
        return TTSResult(
            mime_type="audio/wav",
            audio_base64=base64.b64encode(payload).decode("utf-8"),
            provider=self.provider_name,
        )

    def _generate_wave_bytes(self, text: str) -> bytes:
        duration_seconds = max(0.4, min(2.0, len(text) * 0.04))
        frame_rate = 16000
        total_frames = int(frame_rate * duration_seconds)
        buffer = BytesIO()
        with wave.open(buffer, "wb") as wav_file:
            wav_file.setnchannels(1)
            wav_file.setsampwidth(2)
            wav_file.setframerate(frame_rate)
            frames = bytearray()
            for frame in range(total_frames):
                amplitude = int(10000 * math.sin(frame * 2 * math.pi * 440 / frame_rate))
                frames.extend(amplitude.to_bytes(2, byteorder="little", signed=True))
            wav_file.writeframes(bytes(frames))
        return buffer.getvalue()


class GoogleCloudTTSProvider(BaseTTSProvider):
    provider_name = "google"

    def __init__(self) -> None:
        if texttospeech is None:  # pragma: no cover
            raise RuntimeError("google-cloud-texttospeech is not available")
        self._client = texttospeech.TextToSpeechClient()

    def synthesize(self, request: TTSRequest) -> TTSResult:
        voice_name = None if request.voice == "default" else request.voice
        response = self._client.synthesize_speech(
            input=texttospeech.SynthesisInput(text=request.text),
            voice=texttospeech.VoiceSelectionParams(language_code=request.language, name=voice_name),
            audio_config=texttospeech.AudioConfig(audio_encoding=texttospeech.AudioEncoding.MP3),
        )
        return TTSResult(
            mime_type="audio/mpeg",
            audio_base64=base64.b64encode(response.audio_content).decode("utf-8"),
            provider=self.provider_name,
        )


def build_tts_provider(provider_name: str | None = None) -> BaseTTSProvider:
    selected = (provider_name or os.getenv("TTS_PROVIDER", "mock")).lower()
    if selected == "google":
        return GoogleCloudTTSProvider()
    return MockTTSProvider()
