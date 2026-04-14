from app.services.gemma import BaseGemmaReranker, RerankRequest
from app.services.predictor import PredictionRequest, SuggestionEngine


class ReverseAlphabeticalReranker(BaseGemmaReranker):
    provider_name = "fake-gemma"

    def rerank(self, request: RerankRequest) -> list[str]:
        return sorted(request.candidates, reverse=True)


def test_predictor_uses_reranker_to_change_final_order():
    engine = SuggestionEngine(
        global_phrases=["quiero agua", "quiero ayuda", "quiero ahora"],
        domain_vocabulary=["agua", "ayuda", "ahora"],
        reranker=ReverseAlphabeticalReranker(),
    )

    response = engine.predict(
        PredictionRequest(user_id="demo", text="quiero a", language="es", limit=3)
    )

    assert [item.text for item in response.suggestions] == ["ayuda", "ahora", "agua"]
