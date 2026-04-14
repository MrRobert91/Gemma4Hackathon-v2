# Gemma4Hackathon-v2
Otra prueba para la hackathon de google Deep Mind

## Documentación del proyecto

- [PRD + Arquitectura + Backlog](./PRD_ARQUITECTURA_BACKLOG.md)

## Estructura del monorepo

- `frontend/`: aplicación React + Vite para eye typing en navegador
- `backend/`: API FastAPI para predicción, sesiones y TTS
- `docker-compose.yml`: orquestación local de ambos servicios

## Arranque rápido

### Con Docker

```bash
docker compose up --build
```

- frontend: `http://localhost:3000`
- backend: `http://localhost:8000`

### Frontend local

```bash
cd frontend
npm install
npm run dev
```

### Backend local

```bash
cd backend
python -m venv .venv
. .venv/Scripts/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Fase 2: Gemma y perfiles

El backend ya soporta:

- perfiles persistentes en SQLite
- preferencias de usuario como `dwell_ms` y `high_contrast`
- memoria de frases y léxico por usuario
- reranking de sugerencias con Gemma por proveedor configurable

### Proveedores Gemma soportados

- `GEMMA_PROVIDER=none`: sin reranking, modo demo
- `GEMMA_PROVIDER=openrouter`: OpenRouter con un modelo Gemma expuesto vía API OpenAI-compatible
- `GEMMA_PROVIDER=openai_compat`: endpoint OpenAI-compatible propio sirviendo Gemma
- `GEMMA_PROVIDER=transformers`: carga local con Hugging Face Transformers

### Activar Gemma con OpenRouter

Configura `backend/.env` así:

```env
GEMMA_PROVIDER=openrouter
OPENROUTER_API_KEY=tu_clave
OPENROUTER_MODEL_ID=google/gemma-4-26b-a4b-it:free
OPENROUTER_SITE_URL=http://localhost:3000
OPENROUTER_APP_NAME=EyeSpeak Gemma
```

Luego levanta la stack:

```bash
docker compose up --build
```

### Activar Gemma local con Transformers

```bash
set ENABLE_GEMMA=true
set GEMMA_PROVIDER=transformers
set GEMMA_MODEL_ID=google/gemma-4-E4B-it
set HF_TOKEN=tu_token_de_hugging_face
docker compose up --build
```

Antes de usar la ruta `transformers`, acepta la licencia del modelo Gemma correspondiente en Hugging Face y expón `HF_TOKEN` si el entorno no tiene sesión previa.

### Conectar a un endpoint OpenAI-compatible propio

```bash
set GEMMA_PROVIDER=openai_compat
set GEMMA_BASE_URL=http://host.docker.internal:11434/v1
set GEMMA_MODEL_ID=google/gemma-4-E4B-it
docker compose up --build
```

## Estructura

- `frontend/`: aplicación React/Vite con teclado virtual, dwell selection y proveedor de mirada.
- `backend/`: API FastAPI para predicción, sesiones y TTS.
- `docker-compose.yml`: arranque conjunto para MVP.

## Desarrollo

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
pytest
uvicorn app.main:app --reload
```

## Docker

```bash
docker compose up --build
```
