FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Install system dependencies (psycopg2 needs libpq)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application
COPY app ./app
COPY kafka_consumer.py .
COPY seed_admin.py .

# Copy startup script
COPY start.sh .
RUN chmod +x start.sh

# Copy trained model artifacts and application settings
COPY storage ./storage

# Start with our startup script
CMD ["./start.sh"]