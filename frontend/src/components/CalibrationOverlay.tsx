type CalibrationOverlayProps = {
  activeIndex: number;
  total: number;
  onNext: (x: number, y: number) => void;
};

const points = [
  { x: 10, y: 10 },
  { x: 50, y: 10 },
  { x: 90, y: 10 },
  { x: 10, y: 50 },
  { x: 50, y: 50 },
  { x: 90, y: 50 },
  { x: 10, y: 90 },
  { x: 50, y: 90 },
  { x: 90, y: 90 },
];

export function CalibrationOverlay({ activeIndex, total, onNext }: CalibrationOverlayProps) {
  return (
    <div className="calibration-overlay" aria-label="Calibración">
      <div className="calibration-copy">
        <p className="eyebrow">Calibración</p>
        <p>
          Punto {activeIndex + 1} de {total}. Mira el punto y pulsa para registrar esa posición.
        </p>
      </div>
      {points.map((point, index) => (
        <button
          key={`${point.x}-${point.y}`}
          type="button"
          className={`calibration-point${index === activeIndex ? " calibration-point--active" : ""}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          onClick={(event) => {
            const target = event.currentTarget.getBoundingClientRect();
            onNext(target.left + target.width / 2, target.top + target.height / 2);
          }}
          aria-label={`Punto de calibración ${index + 1}`}
        />
      ))}
    </div>
  );
}
