import { calibrationPointPercentages } from "../lib/calibration";

type CalibrationOverlayProps = {
  activeIndex: number;
  total: number;
  progress: number;
};

export function CalibrationOverlay({ activeIndex, total, progress }: CalibrationOverlayProps) {
  const remainingSeconds = Math.max(0, 5 - progress * 5);

  return (
    <div className="calibration-overlay" aria-label="Calibración">
      <div className="calibration-copy">
        <p className="eyebrow">Calibración</p>
        <p>
          Punto {activeIndex + 1} de {total}. Mantén la mirada fija sobre el punto activo. El avance es automático.
        </p>
        <p className="calibration-copy__hint">
          Revisa la previsualización de la webcam arriba a la derecha: tu cara debe verse centrada y la malla/caja deben seguirla.
        </p>
        <p className="calibration-copy__meta">Tiempo restante: {remainingSeconds.toFixed(1)} s</p>
        <div className="calibration-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
      {calibrationPointPercentages.map((point, index) => (
        <div
          key={`${point.x}-${point.y}`}
          className={`calibration-point${index === activeIndex ? " calibration-point--active" : ""}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          aria-label={`Punto de calibración ${index + 1}`}
        />
      ))}
    </div>
  );
}
