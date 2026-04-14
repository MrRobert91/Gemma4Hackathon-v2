import type { RefCallback } from "react";

import type { SuggestionItem } from "../types";

type SuggestionBarProps = {
  suggestions: SuggestionItem[];
  onSelect: (value: string) => void;
  focusedKeyId: string | null;
  dwellProgress: number;
  registerTarget?: (id: string) => RefCallback<HTMLElement>;
};

export function SuggestionBar({
  suggestions,
  onSelect,
  focusedKeyId,
  dwellProgress,
  registerTarget,
}: SuggestionBarProps) {
  return (
    <section className="suggestions-panel" aria-label="Sugerencias">
      {suggestions.length > 0 ? (
        suggestions.map((item, index) => {
          const keyId = `suggestion-${index}`;
          const isFocused = focusedKeyId === keyId;
          return (
            <button
              key={keyId}
              ref={registerTarget?.(keyId)}
              type="button"
              className={`suggestion-chip${isFocused ? " suggestion-chip--focused" : ""}`}
              onClick={() => onSelect(item.text)}
            >
              <span>{item.text}</span>
              <small>{item.source}</small>
              {isFocused ? (
                <span className="keyboard-key__progress" style={{ transform: `scaleX(${dwellProgress})` }} />
              ) : null}
            </button>
          );
        })
      ) : (
        <div className="suggestion-empty">Escribe o mira una frase rápida para empezar.</div>
      )}
    </section>
  );
}
