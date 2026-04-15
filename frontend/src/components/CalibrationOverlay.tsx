import { calibrationPointPercentages } from "../lib/calibration";

type CalibrationOverlayProps = {
  activeIndex: number;
  activePointIndex?: number;
  total: number;
  progress: number;
};

export function CalibrationOverlay({
  activeIndex,
  activePointIndex = activeIndex,
  total,
  progress,
}: CalibrationOverlayProps) {
  const remainingSeconds = Math.max(0, 5 - progress * 5);

  return (
    <div className="calibration-overlay" aria-label="Calibracion">
      <div className="calibration-copy">
        <p className="eyebrow">Calibracion</p>
        <p>
          Punto {activeIndex + 1} de {total}. Manten la mirada fija sobre el punto activo. El avance es automatico.
        </p>
        <p className="calibration-copy__hint">
          Revisa la previsualizacion de la webcam: tu cara debe verse centrada y la malla y la caja deben seguirla.
        </p>
        <p className="calibration-copy__meta">Tiempo restante: {remainingSeconds.toFixed(1)} s</p>
        <div className="calibration-progress" aria-hidden="true">
          <span style={{ transform: `scaleX(${progress})` }} />
        </div>
      </div>
      {calibrationPointPercentages.map((point, index) => (
        <div
          key={`${point.x}-${point.y}`}
          className={`calibration-point${index === activePointIndex ? " calibration-point--active" : ""}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          aria-label={`Punto de calibracion ${index + 1}`}
        />
      ))}
    </div>
  );
}
