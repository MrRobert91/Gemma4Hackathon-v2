FROM python:3.12-slim

WORKDIR /app

ARG ENABLE_GEMMA=false

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY requirements-gemma.txt .
RUN if [ "$ENABLE_GEMMA" = "true" ]; then pip install --no-cache-dir -r requirements-gemma.txt; fi

COPY app ./app

ENV PYTHONUNBUFFERED=1
ENV TTS_PROVIDER=mock
ENV PROFILE_DB_PATH=/app/data/profiles.db
EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
