type CalibrationPanelProps = {
  calibrated: boolean;
  onCalibrate: () => void;
};

export function CalibrationPanel({ calibrated, onCalibrate }: CalibrationPanelProps) {
  return (
    <section className="calibration-panel">
      <div>
        <p className="eyebrow">Seguimiento ocular</p>
        <h2>{calibrated ? "Calibración activa" : "Calibra antes de escribir"}</h2>
        <p>
          Mira los puntos de calibración y usa un click asistido si estás en modo webcam. Para pruebas rápidas puedes cambiar a modo puntero.
        </p>
      </div>
      <button type="button" className="primary-button" onClick={onCalibrate}>
        {calibrated ? "Recalibrar" : "Iniciar calibración"}
      </button>
    </section>
  );
}
