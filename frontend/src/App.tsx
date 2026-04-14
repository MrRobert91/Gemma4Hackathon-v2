import { startTransition, useCallback, useDeferredValue, useEffect, useMemo, useReducer, useRef, useState } from "react";

import { CalibrationOverlay } from "./components/CalibrationOverlay";
import { CalibrationPanel } from "./components/CalibrationPanel";
import { GazeDiagnosticsPanel } from "./components/GazeDiagnosticsPanel";
import { QuickPhrases } from "./components/QuickPhrases";
import { SuggestionBar } from "./components/SuggestionBar";
import { VirtualKeyboard } from "./components/VirtualKeyboard";
import { useCameraStream } from "./hooks/useCameraStream";
import { useDwellSelection } from "./hooks/useDwellSelection";
import { useGazeProvider } from "./hooks/useGazeProvider";
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
import {
  applyCalibrationToFrame,
  averageFeatureVectors,
  buildCalibrationModelV2,
  createEmptyCalibrationModelV2,
  isCalibrationWindowStable,
  type CalibrationModelV2,
} from "./lib/gazeCalibrationV2";
import {
  calibrationPointPercentages,
  resolveCalibrationTarget,
} from "./lib/calibration";
import { type ProviderMode } from "./lib/gazeProvider";
import type { CalibrationSampleV2, GazeFeatureVector, GazeFrame, GazePoint, PredictionResponse, UserProfile } from "./types";

const defaultQuickPhrases = ["necesito ayuda", "quiero agua", "me duele"];
const demoUserId = "demo-user";
const calibrationHoldMs = 4000;
const calibrationSampleIntervalMs = 100;
const calibrationStabilityRadius = 48;
const minimumCalibrationConfidence = 0.45;

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

function averagePoints(points: GazePoint[]) {
  if (points.length === 0) {
    return null;
  }

  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  };
}

function averageQuality(values: number[]) {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export default function App() {
  const [composerState, dispatch] = useReducer(applyAction, undefined, createInitialComposerState);
  const [providerMode, setProviderMode] = useState<ProviderMode>("mediapipe");
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
  const [calibrationSamples, setCalibrationSamples] = useState<CalibrationSampleV2[]>([]);
  const [calibrationScore, setCalibrationScore] = useState(0);
  const [calibrationModel, setCalibrationModel] = useState<CalibrationModelV2>(createEmptyCalibrationModelV2());
  const [calibrationProgress, setCalibrationProgress] = useState(0);
  const [audioReady, setAudioReady] = useState(false);

  const overlayRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef<GazeFrame | null>(null);
  const calibrationSamplesRef = useRef<CalibrationSampleV2[]>([]);
  const pointWindowRef = useRef<GazePoint[]>([]);
  const featureWindowRef = useRef<GazeFeatureVector[]>([]);
  const qualityWindowRef = useRef<number[]>([]);

  const deferredText = useDeferredValue(composerState.text);
  const camera = useCameraStream({ enabled: providerMode === "mediapipe" });
  const {
    frame,
    ready,
    providerLabel,
    error,
    stage,
    debugLogs,
  } = useGazeProvider({
    mode: providerMode,
    enabled: providerMode === "pointer" || camera.ready,
    videoRef: camera.videoRef,
    overlayRef,
  });

  const rawPoint = frame?.rawPoint ?? null;
  const correctedPoint = useMemo(() => {
    if (!frame) {
      return null;
    }
    if (frame.features && calibrationModel.sampleCount >= 4) {
      return applyCalibrationToFrame(frame.features, calibrationModel);
    }
    return rawPoint;
  }, [calibrationModel, frame, rawPoint]);

  const actionablePoint = useMemo(() => {
    if (
      calibrationActive ||
      !frame ||
      !correctedPoint ||
      !frame.irisDetected ||
      frame.confidence < minimumCalibrationConfidence
    ) {
      return null;
    }
    return correctedPoint;
  }, [calibrationActive, correctedPoint, frame]);

  const displayPoint = useMemo(() => {
    if (calibrationActive) {
      return rawPoint;
    }
    return correctedPoint;
  }, [calibrationActive, correctedPoint, rawPoint]);

  useEffect(() => {
    frameRef.current = frame;
  }, [frame]);

  useEffect(() => {
    calibrationSamplesRef.current = calibrationSamples;
  }, [calibrationSamples]);

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
  }, [dwellMs, highContrast, profile]);

  useEffect(() => {
    if (camera.error) {
      setStatusMessage(`Webcam no disponible: ${camera.error}`);
    }
  }, [camera.error]);

  const handleKeyAction = useCallback((value: string) => {
    dispatch(keyValueToAction(value));
  }, []);

  const handleSuggestionSelect = useCallback((value: string) => {
    dispatch({ type: "applySuggestion", value });
  }, []);

  const allQuickPhrases = useMemo(() => {
    const profileQuickPhrases = profile?.quick_phrases ?? [];
    const unique = new Set<string>();
    return [
      ...predictions.quick_phrases.map((item) => item.text),
      ...profileQuickPhrases,
      ...composerState.recentPhrases,
      ...defaultQuickPhrases,
    ]
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
    gazePoint: actionablePoint,
    dwellMs,
    snapRadius: 64,
    onActivate: handleActivateTarget,
  });

  const handleStartCalibration = useCallback(() => {
    setCalibrationActive(true);
    setCalibrationIndex(0);
    setCalibrationSamples([]);
    calibrationSamplesRef.current = [];
    pointWindowRef.current = [];
    featureWindowRef.current = [];
    qualityWindowRef.current = [];
    setCalibrationProgress(0);
    setCalibrationScore(0);
    setCalibrationModel(createEmptyCalibrationModelV2());
    setStatusMessage("Calibración automática iniciada. Mantén la mirada fija en cada punto hasta que avance.");
    resetDwell();
  }, [resetDwell]);

  useEffect(() => {
    if (!calibrationActive) {
      return;
    }

    let startedAt = Date.now();
    pointWindowRef.current = [];
    featureWindowRef.current = [];
    qualityWindowRef.current = [];
    setCalibrationProgress(0);

    const intervalId = window.setInterval(() => {
      const currentFrame = frameRef.current;
      if (
        currentFrame?.rawPoint &&
        currentFrame.features &&
        currentFrame.irisDetected &&
        !currentFrame.diagnostics.blink &&
        currentFrame.confidence >= minimumCalibrationConfidence
      ) {
        pointWindowRef.current.push(currentFrame.rawPoint);
        featureWindowRef.current.push(currentFrame.features);
        qualityWindowRef.current.push(currentFrame.confidence);
      }

      const elapsedMs = Date.now() - startedAt;
      const progress = Math.min(elapsedMs / calibrationHoldMs, 1);
      setCalibrationProgress(progress);

      if (elapsedMs < calibrationHoldMs) {
        return;
      }

      const target = resolveCalibrationTarget(calibrationIndex, window.innerWidth, window.innerHeight);
      const stable = isCalibrationWindowStable(pointWindowRef.current, calibrationStabilityRadius);
      const averagedFeatures = averageFeatureVectors(featureWindowRef.current);
      const averagedPoint = averagePoints(pointWindowRef.current);
      const quality = averageQuality(qualityWindowRef.current);

      pointWindowRef.current = [];
      featureWindowRef.current = [];
      qualityWindowRef.current = [];

      const nextSamples =
        stable && averagedFeatures && averagedPoint
          ? [...calibrationSamplesRef.current, { features: averagedFeatures, target, quality }]
          : calibrationSamplesRef.current;

      calibrationSamplesRef.current = nextSamples;
      setCalibrationSamples(nextSamples);

      if (calibrationIndex >= calibrationPointPercentages.length - 1) {
        const nextModel = buildCalibrationModelV2(nextSamples);
        setCalibrationModel(nextModel);
        setCalibrationScore(nextModel.score);
        setCalibrationActive(false);
        setCalibrationProgress(0);
        if (nextSamples.length < 4) {
          setStatusMessage(
            "Calibración completada con datos insuficientes. Repite el proceso con mejor iluminación y mantén la mirada estable sobre los puntos.",
          );
          return;
        }
        setStatusMessage(`Calibración completada. Precisión estimada: ${Math.round(nextModel.score * 100)}%.`);
        return;
      }

      setCalibrationIndex((value) => value + 1);
      startedAt = Date.now();
      if (!stable || !averagedFeatures) {
        setStatusMessage(
          `La muestra del punto ${calibrationIndex + 1} no fue estable. Continuando con el punto ${calibrationIndex + 2}.`,
        );
        return;
      }
      setStatusMessage(
        `Calibración en curso. Punto ${calibrationIndex + 2} de ${calibrationPointPercentages.length}. Muestras válidas: ${nextSamples.length}.`,
      );
    }, calibrationSampleIntervalMs);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [calibrationActive, calibrationIndex]);

  return (
    <div className={`app-shell${highContrast ? " app-shell--contrast" : ""}`}>
      {calibrationActive ? (
        <CalibrationOverlay
          activeIndex={calibrationIndex}
          total={calibrationPointPercentages.length}
          progress={calibrationProgress}
        />
      ) : null}

      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">EyeSpeak Gemma</p>
          <h1>Escribe con la mirada. Habla con claridad.</h1>
          <p className="hero__lead">
            MVP web para comunicación asistida con webcam, face mesh + iris, dwell selection, predicción contextual con Gemma y TTS.
          </p>
        </div>

        <div className="hero__controls">
          <label className="control-group">
            <span>Modo de entrada</span>
            <select value={providerMode} onChange={(event) => setProviderMode(event.target.value as ProviderMode)}>
              <option value="mediapipe">Webcam + MediaPipe</option>
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
          <CalibrationPanel
            calibrated={!calibrationActive && calibrationModel.sampleCount >= 4}
            onCalibrate={handleStartCalibration}
          />

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
          <GazeDiagnosticsPanel
            mode={providerMode === "pointer" ? "pointer" : "mediapipe"}
            frame={frame}
            videoRef={camera.videoRef}
            overlayRef={overlayRef}
            cameraReady={camera.ready}
            cameraError={camera.error}
          />

          <section className="status-card">
            <p className="eyebrow">Estado</p>
            <h3>{providerLabel}</h3>
            <ul>
              <li>{ready ? "Seguimiento listo" : "Inicializando proveedor"}</li>
              <li>Etapa: {stage}</li>
              <li>{error ?? camera.error ?? "Sin errores detectados"}</li>
              <li>{statusMessage}</li>
              <li>Score de calibración: {Math.round(calibrationScore * 100)}%</li>
            </ul>
          </section>

          <section className="status-card status-card--debug">
            <p className="eyebrow">Logs Eye Tracking</p>
            <h3>Traza de arranque</h3>
            {debugLogs.length > 0 ? (
              <div className="debug-log-list">
                {debugLogs.map((entry) => (
                  <code key={entry} className="debug-log-entry">
                    {entry}
                  </code>
                ))}
              </div>
            ) : (
              <p className="debug-log-empty">Aún no hay logs disponibles.</p>
            )}
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
              <li>Comprueba en la tarjeta de cámara que aparecen mesh, caja facial e iris.</li>
            </ul>
          </section>
        </aside>
      </main>

      <div className="gaze-hud">
        <strong>Seguimiento visual</strong>
        <span>{calibrationModel.sampleCount >= 4 ? "calibrada" : calibrationActive ? "sin calibrar" : "sin calibrar"}</span>
        <span>{ready ? providerLabel : "inicializando proveedor"}</span>
        <span>
          {displayPoint ? `X ${Math.round(displayPoint.x)} · Y ${Math.round(displayPoint.y)}` : "Esperando coordenadas de mirada"}
        </span>
        <span>
          {frame?.irisDetected
            ? `Confianza ${Math.round(frame.confidence * 100)}%`
            : "Esperando landmarks de iris"}
        </span>
      </div>
      {displayPoint ? (
        <div className="gaze-cursor" style={{ transform: `translate(${displayPoint.x}px, ${displayPoint.y}px)` }}>
          <span className="gaze-cursor__ring" />
          <span className="gaze-cursor__dot" />
        </div>
      ) : null}
      {audioReady ? <div className="sr-only">Audio listo</div> : null}
    </div>
  );
}
