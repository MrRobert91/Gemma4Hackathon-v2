import type { RefCallback } from "react";

type VirtualKeyboardProps = {
  focusedKeyId: string | null;
  dwellProgress: number;
  onKeyPress: (value: string) => void;
  registerTarget?: (id: string) => RefCallback<HTMLElement>;
};

type KeyDefinition = {
  id: string;
  label: string;
  value: string;
  wide?: boolean;
};

const LETTER_ROWS: KeyDefinition[][] = [
  "qwertyuiop".split("").map((key) => ({ id: key, label: key.toUpperCase(), value: key })),
  "asdfghjklñ".split("").map((key) => ({ id: key, label: key.toUpperCase(), value: key })),
  "zxcvbnm".split("").map((key) => ({ id: key, label: key.toUpperCase(), value: key })),
];

const ACTION_KEYS: KeyDefinition[] = [
  { id: "space", label: "ESPACIO", value: "space", wide: true },
  { id: "backspace", label: "BORRAR", value: "backspace" },
  { id: "delete-word", label: "PALABRA", value: "delete-word" },
];

export function VirtualKeyboard({
  focusedKeyId,
  dwellProgress,
  onKeyPress,
  registerTarget,
}: VirtualKeyboardProps) {
  return (
    <section className="keyboard-panel" aria-label="Teclado virtual">
      {LETTER_ROWS.map((row, index) => (
        <div className="keyboard-row" key={`row-${index}`}>
          {row.map((key) => {
            const isFocused = focusedKeyId === key.id;
            return (
              <button
                key={key.id}
                ref={registerTarget?.(key.id)}
                type="button"
                className={`keyboard-key${isFocused ? " keyboard-key--focused" : ""}`}
                onClick={() => onKeyPress(key.value)}
                aria-label={key.label}
              >
                <span>{key.label}</span>
                {isFocused ? (
                  <span className="keyboard-key__progress" style={{ transform: `scaleX(${dwellProgress})` }} />
                ) : null}
              </button>
            );
          })}
        </div>
      ))}
      <div className="keyboard-row keyboard-row--actions">
        {ACTION_KEYS.map((key) => {
          const isFocused = focusedKeyId === key.id;
          return (
            <button
              key={key.id}
              ref={registerTarget?.(key.id)}
              type="button"
              className={`keyboard-key${isFocused ? " keyboard-key--focused" : ""}${key.wide ? " keyboard-key--wide" : ""}`}
              onClick={() => onKeyPress(key.value)}
              aria-label={key.label}
            >
              <span>{key.label}</span>
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
