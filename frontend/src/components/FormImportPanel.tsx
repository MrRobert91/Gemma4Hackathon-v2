type FormImportPanelProps = {
  formUrl: string;
  importing: boolean;
  error: string | null;
  onUrlChange: (url: string) => void;
  onImport: () => void;
};

export function FormImportPanel({ formUrl, importing, error, onUrlChange, onImport }: FormImportPanelProps) {
  return (
    <section className="form-import-panel">
      <div>
        <p className="eyebrow">Formulario</p>
        <h2>Pega una URL publica de Google Forms o Microsoft Forms</h2>
        <p>
          La aplicacion importara preguntas de opcion multiple o casillas y las convertira en decisiones binarias:
          mirar izquierda para No, derecha para Si.
        </p>
      </div>
      <div className="form-import-panel__controls">
        <input
          type="url"
          value={formUrl}
          onChange={(event) => onUrlChange(event.target.value)}
          placeholder="https://docs.google.com/forms/... o https://forms.office.com/r/..."
          aria-label="URL de formulario"
        />
        <button type="button" className="primary-button" onClick={onImport} disabled={importing || formUrl.trim().length === 0}>
          {importing ? "Importando..." : "Importar formulario"}
        </button>
      </div>
      {error ? <p className="form-import-panel__error">{error}</p> : null}
    </section>
  );
}
