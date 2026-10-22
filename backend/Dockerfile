# Phoenix backend + Kafka consumer image.
#
# Same image serves two roles (see docker/docker-compose.yml):
#   backend  -> uvicorn app.main:app
#   consumer -> python kafka_consumer.py

FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app ./app
COPY kafka_consumer.py .
COPY seed_admin.py .

# Storage (models, settings, raw data) is mounted as a volume
# in compose; the dir only needs to exist for local runs.
RUN mkdir -p storage

EXPOSE 1992

HEALTHCHECK --interval=30s --timeout=10s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:1992/health', timeout=8)"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "1992"]
