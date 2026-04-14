from app.services.predictor import PredictionRequest, SuggestionEngine


def build_engine() -> SuggestionEngine:
    return SuggestionEngine(
        global_phrases=[
            "necesito ayuda",
            "quiero agua",
            "hola",
            "gracias",
        ],
        domain_vocabulary=[
            "agua",
            "ayuda",
            "dolor",
            "hola",
            "gracias",
            "necesito",
            "quiero",
            "por",
            "favor",
        ],
    )


def test_predictor_prefers_user_history_and_prefix_matches():
    engine = build_engine()
    engine.learn_phrase("demo", "quiero agua")
    engine.learn_phrase("demo", "quiero agua fria")
    engine.learn_phrase("demo", "quiero ayuda ahora")

    response = engine.predict(
        PredictionRequest(user_id="demo", text="quiero a", language="es")
    )

    suggestions = [item.text for item in response.suggestions]
    assert suggestions[0] == "agua"
    assert "ayuda" in suggestions
    assert len(suggestions) <= 5


def test_predictor_exposes_quick_phrases_for_empty_input():
    engine = build_engine()
    engine.learn_phrase("demo", "necesito ayuda")
    engine.learn_phrase("demo", "quiero agua")

    response = engine.predict(PredictionRequest(user_id="demo", text="", language="es"))

    phrases = [item.text for item in response.quick_phrases]
    assert phrases[0] == "necesito ayuda"
    assert "quiero agua" in phrases


def test_predictor_deduplicates_results_from_multiple_sources():
    engine = build_engine()
    engine.learn_phrase("demo", "hola")

    response = engine.predict(PredictionRequest(user_id="demo", text="ho", language="es"))

    suggestions = [item.text for item in response.suggestions]
    assert suggestions.count("hola") == 1
