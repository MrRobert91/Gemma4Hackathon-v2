from __future__ import annotations

import sqlite3
from pathlib import Path

from pydantic import BaseModel

from app.services.predictor import SuggestionEngine, tokenize


class ProfilePreferences(BaseModel):
    language: str = "es"
    dwell_ms: int = 850
    high_contrast: bool = False


class UserProfile(BaseModel):
    user_id: str
    preferences: ProfilePreferences
    quick_phrases: list[str]


class SqliteProfileStore:
    def __init__(self, database_path: Path | str) -> None:
        self._database_path = Path(database_path)
        self._database_path.parent.mkdir(parents=True, exist_ok=True)
        self._seeded_users: set[str] = set()
        self._initialize()

    def _connect(self) -> sqlite3.Connection:
        connection = sqlite3.connect(self._database_path)
        connection.row_factory = sqlite3.Row
        return connection

    def _initialize(self) -> None:
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS profile_preferences (
                    user_id TEXT PRIMARY KEY,
                    language TEXT NOT NULL DEFAULT 'es',
                    dwell_ms INTEGER NOT NULL DEFAULT 850,
                    high_contrast INTEGER NOT NULL DEFAULT 0
                );
                CREATE TABLE IF NOT EXISTS phrases (
                    user_id TEXT NOT NULL,
                    text TEXT NOT NULL,
                    usage_count INTEGER NOT NULL DEFAULT 1,
                    last_used_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                    PRIMARY KEY (user_id, text)
                );
                CREATE TABLE IF NOT EXISTS lexicon (
                    user_id TEXT NOT NULL,
                    token TEXT NOT NULL,
                    frequency INTEGER NOT NULL DEFAULT 1,
                    PRIMARY KEY (user_id, token)
                );
                """
            )

    def ensure_profile(self, user_id: str) -> None:
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO profile_preferences (user_id) VALUES (?)
                ON CONFLICT(user_id) DO NOTHING
                """,
                (user_id,),
            )

    def upsert_preferences(self, user_id: str, preferences: ProfilePreferences) -> UserProfile:
        self.ensure_profile(user_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO profile_preferences (user_id, language, dwell_ms, high_contrast)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    language=excluded.language,
                    dwell_ms=excluded.dwell_ms,
                    high_contrast=excluded.high_contrast
                """,
                (
                    user_id,
                    preferences.language,
                    preferences.dwell_ms,
                    int(preferences.high_contrast),
                ),
            )
        return self.get_profile(user_id)

    def get_profile(self, user_id: str) -> UserProfile:
        self.ensure_profile(user_id)
        with self._connect() as connection:
            preference_row = connection.execute(
                "SELECT user_id, language, dwell_ms, high_contrast FROM profile_preferences WHERE user_id = ?",
                (user_id,),
            ).fetchone()
            phrase_rows = connection.execute(
                """
                SELECT text FROM phrases
                WHERE user_id = ?
                ORDER BY usage_count DESC, last_used_at DESC
                LIMIT 6
                """,
                (user_id,),
            ).fetchall()

        return UserProfile(
            user_id=user_id,
            preferences=ProfilePreferences(
                language=preference_row["language"],
                dwell_ms=preference_row["dwell_ms"],
                high_contrast=bool(preference_row["high_contrast"]),
            ),
            quick_phrases=[row["text"] for row in phrase_rows],
        )

    def record_phrase(self, user_id: str, phrase: str) -> None:
        cleaned = " ".join(tokenize(phrase))
        if not cleaned:
            return
        self.ensure_profile(user_id)
        with self._connect() as connection:
            connection.execute(
                """
                INSERT INTO phrases (user_id, text, usage_count, last_used_at)
                VALUES (?, ?, 1, CURRENT_TIMESTAMP)
                ON CONFLICT(user_id, text) DO UPDATE SET
                    usage_count = usage_count + 1,
                    last_used_at = CURRENT_TIMESTAMP
                """,
                (user_id, cleaned),
            )
            for token in tokenize(cleaned):
                connection.execute(
                    """
                    INSERT INTO lexicon (user_id, token, frequency)
                    VALUES (?, ?, 1)
                    ON CONFLICT(user_id, token) DO UPDATE SET
                        frequency = frequency + 1
                    """,
                    (user_id, token),
                )

    def get_lexicon(self, user_id: str) -> dict[str, int]:
        self.ensure_profile(user_id)
        with self._connect() as connection:
            rows = connection.execute(
                "SELECT token, frequency FROM lexicon WHERE user_id = ?",
                (user_id,),
            ).fetchall()
        return {row["token"]: row["frequency"] for row in rows}

    def hydrate_engine(self, engine: SuggestionEngine, user_id: str) -> None:
        if user_id in self._seeded_users or engine.has_user_data(user_id):
            return

        with self._connect() as connection:
            rows = connection.execute(
                "SELECT text, usage_count FROM phrases WHERE user_id = ?",
                (user_id,),
            ).fetchall()

        for row in rows:
            for _ in range(row["usage_count"]):
                engine.learn_phrase(user_id, row["text"])
        self._seeded_users.add(user_id)
