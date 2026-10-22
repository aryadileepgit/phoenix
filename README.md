# Phoenix — Adaptive Fraud Transaction Detection Platform

XGBoost fraud scoring on IEEE-CIS data, with Kafka streaming,
drift-triggered retraining, analyst feedback, and a React
operations UI. No mock data: every score, curve, and graph edge
comes from the trained model or stored rows.

## Architecture

```
simulator/  -> Kafka (phoenix-transactions) -> backend/kafka_consumer.py
                                                        -> XGBoost -> Postgres
backend/    FastAPI on :1992 (all routes JWT-guarded, /health + /ready open)
frontend/   React + Vite on :5173 (JWT bearer on every request)
docker/     kafka-only compose (local dev) + full-stack compose (deploy)
```

## Run (local dev, Windows)

Prerequisites: Postgres running, Docker Desktop started,
backend `venv` + `frontend/node_modules` installed.

```powershell
# 1. Kafka (repo root)
docker compose -f docker/docker-compose.kafka.yml up -d

# 2. Backend
cd backend
.\venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 1992

# 3. Kafka consumer (scores stream into Postgres)
cd backend
.\venv\Scripts\python.exe kafka_consumer.py

# 4. Frontend (first time: copy .env.example -> .env, npm install)
cd frontend
npm run dev
```

Open `http://localhost:5173`, log in with the seeded admin
(`seed_admin.py`; override via `PHOENIX_ADMIN_EMAIL` /
`PHOENIX_ADMIN_PASSWORD` env — change `admin123`).

Optional live traffic:

```powershell
cd simulator
.\venv\Scripts\python.exe kafka_producer.py   # normal flow
.\venv\Scripts\python.exe demo_suspicious.py  # HIGH/MEDIUM demo
```

## Run (full stack, Docker)

```bash
docker compose -f docker/docker-compose.yml up -d --build
docker compose -f docker/docker-compose.yml exec backend python seed_admin.py
```

Uses its own Postgres volume (fresh DB). `./backend/storage`
is mounted so the trained model and IEEE data carry over.

## Batch scoring

`POST /dataset/predict-batch/{dataset_id}` with a CSV file
(columns: `transaction_id, account_id, amount,
transaction_time, product_code`, plus optional
`card_information` / `device_information` / `additional_data`
as JSON strings). Each row runs the identical pipeline as
`POST /transactions/score`; per-row results report
`scored` / `failed`, one bad row never fails the batch
(limit 5000 rows).

## Thresholds (empirical basis, v1.2)

Measured on the untouched IEEE test set (118,108 rows,
3.5% fraud):

| cutoff | precision | recall | F1    |
| ------ | --------- | ------ | ----- |
| 0.30   | 0.760     | 0.545  | 0.635 |
| 0.50   | 0.883     | 0.450  | 0.596 |
| 0.70   | 0.936     | 0.367  | 0.528 |

`verify_threshold = 0.30` routes a ~2.5% review queue at 0.76
precision; `fraud_threshold = 0.70` blocks at 0.94 precision.
Change via `PUT /settings`, not code. Retraining stores the
F1-optimal threshold and block precision/recall in
`model_metadata.json` for the record.

## Drift note

The amount-feature KS flag (reference mean ~134 vs recent
~65k) is structural: the simulator generates larger amounts
than the IEEE reference distribution, so it fires by design
while simulated traffic flows. The `fraud_probability`
feature (KS ~0.14) is the meaningful drift signal. Do not
"fix" the amount flag by retuning the reference — that would
mask genuine drift.

## Security notes

- API auth is JWT bearer (`POST /auth/login` -> token,
  8h default via `JWT_EXPIRE_MINUTES`). Set `JWT_SECRET` in
  `backend/.env`; without it the server logs a warning and
  uses a dev fallback.
- `.env` files are gitignored — never commit them.
- Poison Kafka messages retry 5x (`CONSUMER_MAX_RETRIES`),
  then move to `<topic>.dlq` with the error envelope; the
  main partition is never blocked.

## Tests

```powershell
cd backend
.\venv\Scripts\python.exe -m unittest test_auth_tokens test_network_attributes -v
cd ..\frontend
npm run build
```

`test_auth_tokens` runs anywhere. `test_network_attributes`
needs the gitignored IEEE raw CSVs (skips cleanly in CI).
GitHub Actions runs both plus the production build.
