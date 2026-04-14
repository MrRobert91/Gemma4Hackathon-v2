from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass, field
import re
from typing import Iterable

from pydantic import BaseModel, Field
from app.services.gemma import BaseGemmaReranker, NoopGemmaReranker, RerankRequest

TOKEN_RE = re.compile(r"[a-zA-ZáéíóúüñÁÉÍÓÚÜÑ']+")


class SuggestionItem(BaseModel):
    text: str
    source: str
    score: float


class PredictionRequest(BaseModel):
    user_id: str = "demo-user"
    text: str = ""
    language: str = "es"
    limit: int = Field(default=5, ge=1, le=8)


class PredictionResponse(BaseModel):
    suggestions: list[SuggestionItem]
    quick_phrases: list[SuggestionItem]


@dataclass(slots=True)
class UserLanguageModel:
    word_frequency: Counter[str] = field(default_factory=Counter)
    phrase_frequency: Counter[str] = field(default_factory=Counter)
    transitions: dict[str, Counter[str]] = field(default_factory=lambda: defaultdict(Counter))


def normalize_text(value: str) -> str:
    return " ".join(TOKEN_RE.findall(value.lower()))


def tokenize(value: str) -> list[str]:
    return TOKEN_RE.findall(value.lower())


class SuggestionEngine:
    def __init__(
        self,
        global_phrases: Iterable[str],
        domain_vocabulary: Iterable[str],
        reranker: BaseGemmaReranker | None = None,
    ) -> None:
        self._global_phrases = [normalize_text(item) for item in global_phrases if normalize_text(item)]
        self._domain_vocabulary = sorted({normalize_text(item) for item in domain_vocabulary if normalize_text(item)})
        self._user_models: dict[str, UserLanguageModel] = defaultdict(UserLanguageModel)
        self._global_transitions: dict[str, Counter[str]] = defaultdict(Counter)
        self._global_phrase_frequency: Counter[str] = Counter()
        self._reranker = reranker or NoopGemmaReranker()
        for phrase in self._global_phrases:
            self._learn_phrase_global(phrase)

    def _learn_phrase_global(self, phrase: str) -> None:
        if not phrase:
            return
        self._global_phrase_frequency[phrase] += 1
        words = tokenize(phrase)
        for index, word in enumerate(words[:-1]):
            self._global_transitions[word][words[index + 1]] += 1

    def learn_phrase(self, user_id: str, phrase: str) -> None:
        normalized = normalize_text(phrase)
        if not normalized:
            return
        model = self._user_models[user_id]
        model.phrase_frequency[normalized] += 1
        words = tokenize(normalized)
        model.word_frequency.update(words)
        for index, word in enumerate(words[:-1]):
            model.transitions[word][words[index + 1]] += 1

    def predict(self, request: PredictionRequest) -> PredictionResponse:
        model = self._user_models[request.user_id]
        normalized = normalize_text(request.text)
        words = tokenize(normalized)
        prefix = ""
        previous = None

        if request.text and request.text[-1].isspace():
            previous = words[-1] if words else None
        elif words:
            prefix = words[-1]
            previous = words[-2] if len(words) > 1 else None

        scored: dict[str, SuggestionItem] = {}
        self._merge_candidates(scored, self._candidate_words(model, previous, prefix), "history")
        self._merge_candidates(scored, self._candidate_words_from_global(previous, prefix), "ngram")
        self._merge_candidates(scored, self._candidate_words_from_domain(prefix), "domain")

        suggestions = sorted(scored.values(), key=lambda item: item.score, reverse=True)[: request.limit]
        suggestions = self._apply_reranker(request, suggestions)
        quick_phrases = self._quick_phrases_for(model)[:3]
        return PredictionResponse(suggestions=suggestions, quick_phrases=quick_phrases)

    def has_user_data(self, user_id: str) -> bool:
        model = self._user_models.get(user_id)
        return bool(model and (model.word_frequency or model.phrase_frequency))

    def _candidate_words(self, model: UserLanguageModel, previous: str | None, prefix: str) -> list[tuple[str, float]]:
        candidates: Counter[str] = Counter()
        if previous:
            candidates.update({token: count * 1.8 for token, count in model.transitions[previous].items()})
        for token, count in model.word_frequency.items():
            if token.startswith(prefix):
                candidates[token] += count * 1.2
        return list(candidates.items())

    def _candidate_words_from_global(self, previous: str | None, prefix: str) -> list[tuple[str, float]]:
        candidates: Counter[str] = Counter()
        if previous:
            for token, count in self._global_transitions[previous].items():
                candidates[token] += count * 1.4
        if prefix:
            for phrase, count in self._global_phrase_frequency.items():
                for token in tokenize(phrase):
                    if token.startswith(prefix):
                        candidates[token] += count
        return list(candidates.items())

    def _candidate_words_from_domain(self, prefix: str) -> list[tuple[str, float]]:
        candidates = []
        for token in self._domain_vocabulary:
            if not prefix or token.startswith(prefix):
                score = 0.8 if token == prefix else 1.0
                candidates.append((token, score))
        return candidates

    def _merge_candidates(
        self,
        bucket: dict[str, SuggestionItem],
        candidates: list[tuple[str, float]],
        source: str,
    ) -> None:
        for text, score in candidates:
            if not text:
                continue
            existing = bucket.get(text)
            if existing and existing.score >= score:
                continue
            bucket[text] = SuggestionItem(text=text, source=source, score=round(float(score), 3))

    def _quick_phrases_for(self, model: UserLanguageModel) -> list[SuggestionItem]:
        phrases = model.phrase_frequency.most_common(3)
        if phrases:
            return [SuggestionItem(text=text, source="history", score=float(score)) for text, score in phrases]
        return [
            SuggestionItem(text=text, source="default", score=float(score))
            for text, score in self._global_phrase_frequency.most_common(3)
        ]

    def _apply_reranker(
        self,
        request: PredictionRequest,
        suggestions: list[SuggestionItem],
    ) -> list[SuggestionItem]:
        if len(suggestions) < 2:
            return suggestions

        ordered = self._reranker.rerank(
            RerankRequest(
                user_id=request.user_id,
                language=request.language,
                context=request.text,
                candidates=[item.text for item in suggestions],
            )
        )
        if not ordered:
            return suggestions

        by_text = {item.text: item for item in suggestions}
        reranked = [by_text[text] for text in ordered if text in by_text]
        remaining = [item for item in suggestions if item.text not in ordered]
        return reranked + remaining
