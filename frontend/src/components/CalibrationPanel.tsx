type CalibrationPanelProps = {
  calibrated: boolean;
  onCalibrate: () => void;
};

export function CalibrationPanel({ calibrated, onCalibrate }: CalibrationPanelProps) {
  return (
    <section className="calibration-panel">
      <div>
        <p className="eyebrow">Seguimiento ocular</p>
        <h2>{calibrated ? "Calibración lista" : "Calibra antes de escribir"}</h2>
        <p>
          Mantén la mirada fija sobre cada punto hasta que el sistema avance solo. Revisa la vista de cámara para confirmar que aparecen la malla facial y los iris.
        </p>
      </div>
      <button type="button" className="primary-button" onClick={onCalibrate}>
        {calibrated ? "Recalibrar" : "Iniciar calibración"}
      </button>
    </section>
  );
}
