from app.services.gemma import OpenRouterGemmaReranker, RerankRequest


class DummyResponse:
    def __init__(self, payload: dict) -> None:
        self._payload = payload

    def raise_for_status(self) -> None:
        return None

    def json(self) -> dict:
        return self._payload


def test_openrouter_reranker_parses_json_array_from_chat_completion(monkeypatch):
    def fake_post(*args, **kwargs):
        return DummyResponse(
            {
                "choices": [
                    {
                        "message": {
                            "content": '["ayuda", "agua", "ahora"]'
                        }
                    }
                ]
            }
        )

    monkeypatch.setattr("httpx.post", fake_post)

    reranker = OpenRouterGemmaReranker(
        api_key="test-key",
        model="google/gemma-4-26b-a4b-it:free",
    )
    ordered = reranker.rerank(
        RerankRequest(
            user_id="demo",
            language="es",
            context="quiero a",
            candidates=["agua", "ahora", "ayuda"],
        )
    )

    assert ordered == ["ayuda", "agua", "ahora"]
