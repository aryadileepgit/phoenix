#!/bin/sh
# Startup script for Render deployment

set -e

echo "Starting Phoenix backend..."

# Wait for database to be ready
echo "Waiting for database..."
python -c "
import os
import time
import psycopg2
from urllib.parse import urlparse

url = os.getenv('DATABASE_URL')
if not url:
    print('DATABASE_URL not set')
    exit(1)

parsed = urlparse(url)
host = parsed.hostname
port = parsed.port or 5432
user = parsed.username
password = parsed.password
dbname = parsed.path[1:]

for i in range(30):
    try:
        conn = psycopg2.connect(host=host, port=port, user=user, password=password, dbname=dbname, connect_timeout=5)
        conn.close()
        print('Database is ready!')
        break
    except Exception as e:
        print(f'Waiting for database... ({i+1}/30)')
        time.sleep(2)
else:
    print('Database not ready after 60 seconds')
    exit(1)
"

# Create tables
echo "Creating database tables..."
python -c "
from app.database.database import engine
from app.database.base import Base
Base.metadata.create_all(bind=engine)
print('Tables created successfully')
"

# Seed admin user
echo "Seeding admin user..."
python seed_admin.py

# Start the application
echo "Starting FastAPI server..."
PORT="${PORT:-10000}"
exec python -m uvicorn app.main:app --host 0.0.0.0 --port "$PORT"