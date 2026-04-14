from pathlib import Path
from uuid import uuid4

from app.services.profiles import ProfilePreferences, SqliteProfileStore


def test_profile_store_persists_preferences_and_phrase_history():
    database_path = _workspace_database_path()

    first_store = SqliteProfileStore(database_path)
    first_store.upsert_preferences(
        "demo-user",
        ProfilePreferences(language="es", dwell_ms=900, high_contrast=True),
    )
    first_store.record_phrase("demo-user", "necesito ayuda")
    first_store.record_phrase("demo-user", "quiero agua")

    second_store = SqliteProfileStore(database_path)
    profile = second_store.get_profile("demo-user")

    assert profile.user_id == "demo-user"
    assert profile.preferences.language == "es"
    assert profile.preferences.dwell_ms == 900
    assert profile.preferences.high_contrast is True
    assert len(profile.quick_phrases) == 2
    assert profile.quick_phrases[0] in {"quiero agua", "necesito ayuda"}
    assert "necesito ayuda" in profile.quick_phrases


def test_profile_store_tracks_lexicon_frequency():
    database_path = _workspace_database_path()
    store = SqliteProfileStore(database_path)

    store.record_phrase("demo-user", "quiero agua")
    store.record_phrase("demo-user", "quiero ayuda")

    lexicon = store.get_lexicon("demo-user")

    assert lexicon["quiero"] == 2
    assert lexicon["agua"] == 1
    assert lexicon["ayuda"] == 1


def _workspace_database_path() -> Path:
    temp_dir = Path(__file__).resolve().parent / ".tmp"
    temp_dir.mkdir(parents=True, exist_ok=True)
    return temp_dir / f"{uuid4().hex}.db"
