from __future__ import annotations

from collections import deque
from dataclasses import dataclass, field
from datetime import UTC, datetime
from uuid import uuid4


@dataclass(slots=True)
class Session:
    session_id: str
    user_id: str
    started_at: datetime


@dataclass(slots=True)
class SessionSnapshot:
    session_id: str
    user_id: str
    current_text: str = ""
    selection_count: int = 0
    recent_phrases: list[str] = field(default_factory=list)


class InMemorySessionStore:
    def __init__(self) -> None:
        self._sessions: dict[str, SessionSnapshot] = {}

    def start_session(self, user_id: str) -> Session:
        session_id = uuid4().hex
        self._sessions[session_id] = SessionSnapshot(session_id=session_id, user_id=user_id)
        return Session(session_id=session_id, user_id=user_id, started_at=datetime.now(UTC))

    def update_text(self, session_id: str, text: str) -> SessionSnapshot:
        session = self._require_session(session_id)
        session.current_text = text
        return session

    def track_selection(self, session_id: str, value: str) -> SessionSnapshot:
        session = self._require_session(session_id)
        session.selection_count += 1
        session.current_text += value
        return session

    def commit_phrase(self, session_id: str, phrase: str) -> SessionSnapshot:
        session = self._require_session(session_id)
        recent = deque(session.recent_phrases, maxlen=5)
        cleaned = phrase.strip()
        if cleaned:
            recent.appendleft(cleaned)
        session.recent_phrases = list(recent)
        session.current_text = ""
        return session

    def get_snapshot(self, session_id: str) -> SessionSnapshot:
        return self._require_session(session_id)

    def _require_session(self, session_id: str) -> SessionSnapshot:
        if session_id not in self._sessions:
            raise KeyError(f"Unknown session {session_id}")
        return self._sessions[session_id]
