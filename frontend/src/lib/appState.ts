export type ComposerState = {
  text: string;
  recentPhrases: string[];
};

export type ComposerAction =
  | { type: "append"; value: string }
  | { type: "space" }
  | { type: "backspace" }
  | { type: "deleteWord" }
  | { type: "applySuggestion"; value: string }
  | { type: "replaceText"; value: string }
  | { type: "commitPhrase" };

export function createInitialComposerState(): ComposerState {
  return {
    text: "",
    recentPhrases: [],
  };
}

function trimTrailingSpace(value: string): string {
  return value.replace(/\s+$/, "");
}

export function applyAction(state: ComposerState, action: ComposerAction): ComposerState {
  switch (action.type) {
    case "append":
      return { ...state, text: `${state.text}${action.value}` };
    case "space": {
      const nextText = state.text.endsWith(" ") || state.text.length === 0 ? state.text : `${state.text} `;
      return { ...state, text: nextText };
    }
    case "backspace":
      return { ...state, text: state.text.slice(0, -1) };
    case "deleteWord": {
      const trimmed = trimTrailingSpace(state.text);
      const words = trimmed.split(/\s+/);
      words.pop();
      return { ...state, text: words.join(" ") };
    }
    case "applySuggestion": {
      const trimmed = trimTrailingSpace(state.text);
      const words = trimmed.length > 0 ? trimmed.split(/\s+/) : [];
      const lastWord = words.length > 0 ? words[words.length - 1] : "";
      const shouldReplaceLastWord = lastWord.length > 0 && action.value.startsWith(lastWord);
      const prefixWords = shouldReplaceLastWord ? words.slice(0, -1) : words;
      const merged = [...prefixWords, action.value].filter(Boolean).join(" ");
      return { ...state, text: `${merged} ` };
    }
    case "replaceText":
      return { ...state, text: action.value };
    case "commitPhrase": {
      const phrase = trimTrailingSpace(state.text);
      const recentPhrases = phrase
        ? [phrase, ...state.recentPhrases.filter((item) => item !== phrase)].slice(0, 5)
        : state.recentPhrases;
      return {
        ...state,
        text: "",
        recentPhrases,
      };
    }
    default:
      return state;
  }
}
