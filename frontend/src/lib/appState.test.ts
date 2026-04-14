import { applyAction, createInitialComposerState } from "./appState";

describe("composer state", () => {
  it("appends characters and spaces", () => {
    let state = createInitialComposerState();

    state = applyAction(state, { type: "append", value: "h" });
    state = applyAction(state, { type: "append", value: "o" });
    state = applyAction(state, { type: "space" });
    state = applyAction(state, { type: "append", value: "l" });
    state = applyAction(state, { type: "append", value: "a" });

    expect(state.text).toBe("ho la");
  });

  it("supports delete word and backspace", () => {
    let state = createInitialComposerState();
    state = { ...state, text: "quiero agua" };

    state = applyAction(state, { type: "backspace" });
    expect(state.text).toBe("quiero agu");

    state = applyAction(state, { type: "deleteWord" });
    expect(state.text).toBe("quiero");
  });

  it("applies suggestion and commits phrase to recent history", () => {
    let state = createInitialComposerState();
    state = { ...state, text: "necesito ay" };

    state = applyAction(state, { type: "applySuggestion", value: "ayuda" });
    expect(state.text).toBe("necesito ayuda ");

    state = applyAction(state, { type: "commitPhrase" });
    expect(state.text).toBe("");
    expect(state.recentPhrases[0]).toBe("necesito ayuda");
  });
});
