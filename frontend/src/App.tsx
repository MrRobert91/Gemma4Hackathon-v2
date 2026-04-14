import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useReducer, useState } from "react";

import { CalibrationOverlay } from "./components/CalibrationOverlay";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { QuickPhrases } from "./components/QuickPhrases";
import { SuggestionBar } from "./components/SuggestionBar";
import { VirtualKeyboard } from "./components/VirtualKeyboard";
import { useDwellSelection } from "./hooks/useDwellSelection";
import { useEyeTracking } from "./hooks/useEyeTracking";
import {
  commitSessionPhrase,
  fetchPredictions,
  fetchProfile,
  requestSpeech,
  startSession,
  updateProfile,
  updateSessionText,
} from "./lib/api";
import { applyAction, createInitialComposerState } from "./lib/appState";
import { applyCalibration, buildCalibrationModel, identityCalibration, type CalibrationSample } from "./lib/calibration";
import type { PredictionResponse, UserProfile } from "./types";

const defaultQuickPhrases = ["necesito ayuda", "quiero agua", "me duele"];
const demoUserId = "demo-user";

function keyValueToAction(value: string) {
  switch (value) {
    case "space":
      return { type: "space" } as const;
    case "backspace":
      return { type: "backspace" } as const;
    case "delete-word":
      return { type: "deleteWord" } as const;
    default:
      return { type: "append", value } as const;
  }
}

export default function App() {
  const [composerState, dispatch] = useReducer(applyAction, undefined, createInitialComposerState);
  const [providerMode, setProviderMode] = useState<"webgazer" | "pointer">("webgazer");
  const [dwellMs, setDwellMs] = useState(850);
  const [highContrast, setHighContrast] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [predictions, setPredictions] = useState<PredictionResponse>({
    suggestions: [],
    quick_phrases: defaultQuickPhrases.map((text) => ({ text, source: "default", score: 1 })),
  });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [statusMessage, setStatusMessage] = useState("Listo para calibrar.");
  const [calibrationActive, setCalibrationActive] = useState(false);
  const [calibrationIndex, setCalibrationIndex] = useState(0);
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSample[]>([]);
  const [calibrationScore, setCalibrationScore] = useState(0);
  const [calibrationModel, setCalibrationModel] = useState(identityCalibration());
  const [audioReady, setAudioReady] = useState(false);

  const deferredText = useDeferredValue(composerState.text);
  const { point: rawPoint, ready, providerLabel, error } = useEyeTracking({ mode: providerMode });
  const correctedPoint = useMemo(
    () => (rawPoint ? applyCalibration(rawPoint, calibrationModel) : null),
    [calibrationModel, rawPoint],
  );

  useEffect(() => {
    let cancelled = false;
    void Promise.all([startSession(demoUserId), fetchProfile(demoUserId)])
      .then(([session, loadedProfile]) => {
        if (cancelled) {
          return;
        }
        setSessionId(session.session_id);
        setProfile(loadedProfile);
        setDwellMs(loadedProfile.preferences.dwell_ms);
        setHighContrast(loadedProfile.preferences.high_contrast);
      })
      .catch(() => {
        if (!cancelled) {
          setStatusMessage("No se pudo cargar el perfil o la sesión del backend.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!sessionId) {
      return;
    }
    void updateSessionText(sessionId, composerState.text);
  }, [composerState.text, sessionId]);

  useEffect(() => {
    let cancelled = false;
    void fetchPredictions(deferredText.trim(), demoUserId)
      .then((response) => {
        if (!cancelled) {
          startTransition(() => setPredictions(response));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setStatusMessage("Predicción no disponible; usando frases rápidas locales.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [deferredText]);

  useEffect(() => {
    if (!profile) {
      return;
    }
    void updateProfile(demoUserId, {
      language: profile.preferences.language,
      dwell_ms: dwellMs,
      high_contrast: highContrast,
    }).then((nextProfile) => setProfile(nextProfile));
  }, [dwellMs, highContrast]);

  const handleKeyAction = useCallback((value: string) => {
    dispatch(keyValueToAction(value));
  }, []);

  const handleSuggestionSelect = useCallback((value: string) => {
    dispatch({ type: "applySuggestion", value });
  }, []);

  const allQuickPhrases = useMemo(() => {
    const profileQuickPhrases = profile?.quick_phrases ?? [];
    const unique = new Set<string>();
    return [...predictions.quick_phrases.map((item) => item.text), ...profileQuickPhrases, ...composerState.recentPhrases, ...defaultQuickPhrases]
      .filter((item) => {
        if (unique.has(item)) {
          return false;
        }
        unique.add(item);
        return true;
      })
      .slice(0, 6);
  }, [composerState.recentPhrases, predictions.quick_phrases, profile?.quick_phrases]);

  const handleQuickPhrase = useCallback((phrase: string) => {
    dispatch({ type: "replaceText", value: phrase });
  }, []);

  const handleSpeak = useCallback(async () => {
    const phrase = composerState.text.trim();
    if (!phrase) {
      return;
    }
    setIsSpeaking(true);
    setStatusMessage("Generando voz...");
    try {
      const response = await requestSpeech(phrase);
      const audio = new Audio(`data:${response.mime_type};base64,${response.audio_base64}`);
      setAudioReady(true);
      await audio.play();
      setStatusMessage(`Audio reproducido con ${response.provider}.`);
      dispatch({ type: "commitPhrase" });
      if (sessionId) {
        await commitSessionPhrase(sessionId, phrase);
      }
      const refreshedProfile = await fetchProfile(demoUserId);
      setProfile(refreshedProfile);
    } catch {
      setStatusMessage("No se pudo sintetizar la frase.");
    } finally {
      setIsSpeaking(false);
    }
  }, [composerState.text, sessionId]);

  const handleActivateTarget = useCallback(
    (targetId: string) => {
      if (targetId.startsWith("suggestion-")) {
        const suggestion = predictions.suggestions[Number(targetId.replace("suggestion-", ""))];
        if (suggestion) {
          handleSuggestionSelect(suggestion.text);
        }
        return;
      }
      if (targetId.startsWith("quick-")) {
        const phrase = allQuickPhrases[Number(targetId.replace("quick-", ""))];
        if (phrase) {
          handleQuickPhrase(phrase);
        }
        return;
      }
      if (targetId === "speak") {
        void handleSpeak();
        return;
      }
      handleKeyAction(targetId === "delete-word" ? "delete-word" : targetId);
    },
    [allQuickPhrases, handleKeyAction, handleQuickPhrase, handleSpeak, handleSuggestionSelect, predictions.suggestions],
  );

  const { focusedKeyId, dwellProgress, registerTarget, resetDwell } = useDwellSelection({
    gazePoint: calibrationActive ? null : correctedPoint,
    dwellMs,
    snapRadius: 48,
    onActivate: handleActivateTarget,
  });

  const handleStartCalibration = () => {
    setCalibrationActive(true);
    setCalibrationIndex(0);
    setCalibrationSamples([]);
    resetDwell();
  };

  const handleCalibrationPoint = (x: number, y: number) => {
    window.webgazer?.recordScreenPosition?.(x, y, "click");
    if (!rawPoint) {
      setStatusMessage("No hay punto de mirada disponible todavía. Espera a que el proveedor esté listo.");
      return;
    }

    const nextSamples = [...calibrationSamples, { raw: rawPoint, target: { x, y } }];
    setCalibrationSamples(nextSamples);

    if (calibrationIndex >= 8) {
      const nextModel = buildCalibrationModel(nextSamples);
      setCalibrationModel(nextModel);
      setCalibrationScore(nextModel.score);
      setCalibrationActive(false);
      setStatusMessage(`Calibración completada. Precisión estimada: ${Math.round(nextModel.score * 100)}%.`);
      return;
    }
    setCalibrationIndex((value) => value + 1);
  };

  return (
    <div className={`app-shell${highContrast ? " app-shell--contrast" : ""}`}>
      {calibrationActive ? (
        <CalibrationOverlay activeIndex={calibrationIndex} total={9} onNext={handleCalibrationPoint} />
      ) : null}

      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">EyeSpeak Gemma</p>
          <h1>Escribe con la mirada. Habla con claridad.</h1>
          <p className="hero__lead">
            MVP web para comunicación asistida con webcam, dwell selection, predicción contextual con Gemma y TTS.
          </p>
        </div>

        <div className="hero__controls">
          <label className="control-group">
            <span>Modo de entrada</span>
            <select value={providerMode} onChange={(event) => setProviderMode(event.target.value as "webgazer" | "pointer")}>
              <option value="webgazer">Webcam + WebGazer</option>
              <option value="pointer">Simulación con puntero</option>
            </select>
          </label>
          <label className="control-group">
            <span>Dwell</span>
            <input type="range" min="500" max="1600" step="50" value={dwellMs} onChange={(event) => setDwellMs(Number(event.target.value))} />
            <strong>{dwellMs} ms</strong>
          </label>
          <label className="control-group control-group--toggle">
            <span>Contraste alto</span>
            <input type="checkbox" checked={highContrast} onChange={(event) => setHighContrast(event.target.checked)} />
          </label>
        </div>
      </header>

      <main className="workspace">
        <section className="workspace-main">
          <CalibrationPanel calibrated={!calibrationActive} onCalibrate={handleStartCalibration} />

          <section className="composer-panel">
            <header>
              <p className="eyebrow">Frase actual</p>
              <h2>{composerState.text.trim().length > 0 ? composerState.text : "Empieza a escribir con la mirada"}</h2>
            </header>
            <button
              ref={registerTarget("speak")}
              type="button"
              className={`speak-button${focusedKeyId === "speak" ? " speak-button--focused" : ""}`}
              onClick={() => void handleSpeak()}
              disabled={isSpeaking || composerState.text.trim().length === 0}
            >
              {isSpeaking ? "Reproduciendo..." : "Hablar"}
              {focusedKeyId === "speak" ? (
                <span className="keyboard-key__progress" style={{ transform: `scaleX(${dwellProgress})` }} />
              ) : null}
            </button>
          </section>

          <SuggestionBar
            suggestions={predictions.suggestions}
            onSelect={handleSuggestionSelect}
            focusedKeyId={focusedKeyId}
            dwellProgress={dwellProgress}
            registerTarget={registerTarget}
          />

          <VirtualKeyboard
            focusedKeyId={focusedKeyId}
            dwellProgress={dwellProgress}
            onKeyPress={handleKeyAction}
            registerTarget={registerTarget}
          />
        </section>

        <aside className="workspace-side">
          <section className="status-card">
            <p className="eyebrow">Estado</p>
            <h3>{providerLabel}</h3>
            <ul>
              <li>{ready ? "Seguimiento listo" : "Inicializando proveedor"}</li>
              <li>{error ?? "Sin errores detectados"}</li>
              <li>{statusMessage}</li>
              <li>Score de calibración: {Math.round(calibrationScore * 100)}%</li>
            </ul>
          </section>

          <QuickPhrases
            phrases={allQuickPhrases}
            onSelect={handleQuickPhrase}
            focusedKeyId={focusedKeyId}
            dwellProgress={dwellProgress}
            registerTarget={registerTarget}
          />

          <section className="status-card">
            <p className="eyebrow">Consejos</p>
            <ul>
              <li>Usa una webcam a la altura de los ojos.</li>
              <li>Mantén la cabeza estable durante la calibración.</li>
              <li>Empieza en modo puntero si quieres validar la UI sin cámara.</li>
            </ul>
          </section>
        </aside>
      </main>

      {correctedPoint ? <div className="gaze-cursor" style={{ transform: `translate(${correctedPoint.x}px, ${correctedPoint.y}px)` }} /> : null}
      {audioReady ? <div className="sr-only">Audio listo</div> : null}
    </div>
  );
}
