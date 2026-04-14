import type { RefCallback } from "react";

type QuickPhrasesProps = {
  phrases: string[];
  onSelect: (phrase: string) => void;
  focusedKeyId: string | null;
  dwellProgress: number;
  registerTarget?: (id: string) => RefCallback<HTMLElement>;
};

export function QuickPhrases({
  phrases,
  onSelect,
  focusedKeyId,
  dwellProgress,
  registerTarget,
}: QuickPhrasesProps) {
  return (
    <section className="quick-phrases-panel" aria-label="Frases rápidas">
      <header>
        <h3>Frases rápidas</h3>
      </header>
      <div className="quick-phrases-list">
        {phrases.map((phrase, index) => {
          const keyId = `quick-${index}`;
          const isFocused = focusedKeyId === keyId;
          return (
            <button
              key={keyId}
              ref={registerTarget?.(keyId)}
              type="button"
              className={`quick-phrase${isFocused ? " quick-phrase--focused" : ""}`}
              onClick={() => onSelect(phrase)}
            >
              <span>{phrase}</span>
              {isFocused ? (
                <span className="keyboard-key__progress" style={{ transform: `scaleX(${dwellProgress})` }} />
              ) : null}
            </button>
          );
        })}
      </div>
    </section>
  );
}
