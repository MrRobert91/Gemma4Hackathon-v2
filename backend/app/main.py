from __future__ import annotations

from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from app.config import Settings
from app.services.gemma import build_gemma_reranker
from app.services.predictor import PredictionRequest, PredictionResponse, SuggestionEngine
from app.services.profiles import ProfilePreferences, SqliteProfileStore, UserProfile
from app.services.session_store import InMemorySessionStore, Session, SessionSnapshot
from app.services.tts import BaseTTSProvider, TTSRequest, TTSResult, build_tts_provider


class SessionStartRequest(BaseModel):
    user_id: str = "demo-user"


class SessionTextRequest(BaseModel):
    text: str


class SessionCommitRequest(BaseModel):
    phrase: str


def build_default_engine() -> SuggestionEngine:
    engine = SuggestionEngine(
        global_phrases=[
            "necesito ayuda",
            "quiero agua",
            "quiero descansar",
            "hola",
            "gracias",
            "por favor",
            "me duele",
            "quiero hablar con mi familia",
        ],
        domain_vocabulary=[
            "agua",
            "ahora",
            "ayuda",
            "baño",
            "borrar",
            "comer",
            "descansar",
            "dolor",
            "familia",
            "gracias",
            "hablar",
            "hola",
            "medicina",
            "necesito",
            "por",
            "favor",
            "quiero",
            "sí",
            "no",
        ],
        reranker=build_gemma_reranker(),
    )
    engine.learn_phrase("demo", "quiero agua")
    engine.learn_phrase("demo", "quiero ayuda")
    return engine


@asynccontextmanager
async def lifespan(_: FastAPI):
    yield


def create_app(
    settings: Settings | None = None,
    engine: SuggestionEngine | None = None,
    tts_provider: BaseTTSProvider | None = None,
    session_store: InMemorySessionStore | None = None,
    profile_store: SqliteProfileStore | None = None,
) -> FastAPI:
    app_settings = settings or Settings.from_env()
    app = FastAPI(title=app_settings.app_name, lifespan=lifespan)

    app.add_middleware(
        CORSMiddleware,
        allow_origins=app_settings.allowed_origins or ["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    prediction_engine = engine or build_default_engine()
    sessions = session_store or InMemorySessionStore()
    provider = tts_provider or build_tts_provider(app_settings.tts_provider)
    profiles = profile_store or SqliteProfileStore(Path(app_settings.profile_db_path))

    @app.get("/health")
    def healthcheck() -> dict[str, str]:
        return {"status": "ok"}

    @app.post("/api/predict", response_model=PredictionResponse)
    def predict(payload: PredictionRequest) -> PredictionResponse:
        profiles.hydrate_engine(prediction_engine, payload.user_id)
        return prediction_engine.predict(payload)

    @app.post("/api/tts", response_model=TTSResult)
    def synthesize(payload: TTSRequest) -> TTSResult:
        return provider.synthesize(payload)

    @app.post("/api/sessions/start", response_model=Session)
    def start_session(payload: SessionStartRequest) -> Session:
        profiles.ensure_profile(payload.user_id)
        return sessions.start_session(payload.user_id)

    @app.post("/api/sessions/{session_id}/text", response_model=SessionSnapshot)
    def update_session_text(session_id: str, payload: SessionTextRequest) -> SessionSnapshot:
        return sessions.update_text(session_id, payload.text)

    @app.post("/api/sessions/{session_id}/commit", response_model=SessionSnapshot)
    def commit_session_phrase(session_id: str, payload: SessionCommitRequest) -> SessionSnapshot:
        snapshot = sessions.get_snapshot(session_id)
        profiles.record_phrase(snapshot.user_id, payload.phrase)
        prediction_engine.learn_phrase(snapshot.user_id, payload.phrase)
        return sessions.commit_phrase(session_id, payload.phrase)

    @app.get("/api/sessions/{session_id}", response_model=SessionSnapshot)
    def get_session_snapshot(session_id: str) -> SessionSnapshot:
        return sessions.get_snapshot(session_id)

    @app.get("/api/profiles/{user_id}", response_model=UserProfile)
    def get_profile(user_id: str) -> UserProfile:
        return profiles.get_profile(user_id)

    @app.put("/api/profiles/{user_id}", response_model=UserProfile)
    def update_profile(user_id: str, payload: ProfilePreferences) -> UserProfile:
        return profiles.upsert_preferences(user_id, payload)

    return app


app = create_app()
