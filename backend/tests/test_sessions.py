from app.services.predictor import PredictionRequest
from app.services.session_store import InMemorySessionStore


def test_session_store_tracks_recent_phrases_and_stats():
    store = InMemorySessionStore()

    session = store.start_session("demo-user")
    store.track_selection(session.session_id, "h")
    store.track_selection(session.session_id, "o")
    store.commit_phrase(session.session_id, "hola")

    snapshot = store.get_snapshot(session.session_id)

    assert snapshot.current_text == ""
    assert snapshot.selection_count == 2
    assert snapshot.recent_phrases[0] == "hola"


def test_session_store_updates_current_text_incrementally():
    store = InMemorySessionStore()
    session = store.start_session("demo-user")

    store.update_text(session.session_id, "quiero")
    store.update_text(session.session_id, "quiero agua")

    snapshot = store.get_snapshot(session.session_id)
    assert snapshot.current_text == "quiero agua"
    assert snapshot.user_id == "demo-user"
