## Overview

This project uses **OpenTelemetry** for tracing, metrics, and logging, exported to **Grafana Cloud** (or any OTLP-compatible backend). Configuration is controlled entirely via environment variables so you can easily switch between Grafana accounts or stacks per environment.

### Components

- **Backend (FastAPI)**: `backend/app/main.py`, `backend/app/routers/pipeline.py`, `backend/app/observability/*`
- **Frontend (React)**: `frontend/src/main.tsx`, `frontend/src/observability/otel.ts`
- **Dashboards / Alerts**: created in Grafana UI using the exported traces, metrics, and logs.

---

## Backend configuration (FastAPI)

### Key modules

- `app/observability/config.py`
  - Resolves effective OpenTelemetry settings, supports multiple Grafana accounts via env.
- `app/observability/tracing.py`
  - Initializes `TracerProvider`, OTLP HTTP exporter, and FastAPI instrumentation.
- `app/observability/logging.py`
  - Configures JSON-like logs with injected `trace_id` and `span_id`, and exports logs to Grafana Cloud Logs (OTLP) via the same endpoint base (`/v1/logs`).
- `app/routers/pipeline.py`
  - Emits spans and custom metrics around pipeline stages.

### Core environment variables

Basic toggles:

- `OBSERVABILITY_ENABLED`:
  - `true` (default in non-local) to enable tracing/logs/metrics.
  - `false` to disable all OpenTelemetry exporters (no-op).
- `SERVICE_NAME`:
  - Logical service name, default: `blog2video-backend`.
- `DEPLOY_ENV`:
  - Deployment environment, e.g. `dev`, `staging`, `prod`. Default: `dev`.

Multi-account selection:

- `GRAFANA_ACCOUNT`:
  - Logical account key, e.g. `dev`, `staging`, `prod`. Defaults to the value of `DEPLOY_ENV`.
- `GRAFANA_<ACCOUNT>_OTLP_ENDPOINT`:
  - OTLP HTTP endpoint for that account. Example:
    - `GRAFANA_DEV_OTLP_ENDPOINT=https://otlp-gateway-dev.grafana.net/otlp/v1/traces`
  - The same endpoint is typically used for traces/metrics/logs in Grafana Cloud.
- `GRAFANA_<ACCOUNT>_OTLP_HEADERS`:
  - Comma-separated HTTP headers for that account, e.g.:
    - `GRAFANA_DEV_OTLP_HEADERS=Authorization=Basic abc123,Content-Type=application/x-protobuf`

Fallbacks (if per-account vars are not set):

- `OTEL_EXPORTER_OTLP_ENDPOINT`
- `OTEL_EXPORTER_OTLP_HEADERS`

The resolver in `app/observability/config.py`:

```python:backend/app/observability/config.py
settings = get_otel_settings()
```

It computes:

- `enabled`: whether observability is on.
- `service_name`: final service name.
- `environment`: deployment environment.
- `otlp_endpoint`: final OTLP endpoint (account-specific or fallback).
- `otlp_headers`: final headers map (parsed from the env string).

### Example `.env` snippets (backend)

**Dev account:**

```env
DEPLOY_ENV=dev
GRAFANA_ACCOUNT=DEV

GRAFANA_DEV_OTLP_ENDPOINT=https://otlp-gateway-dev.grafana.net/otlp/v1/traces
GRAFANA_DEV_OTLP_HEADERS=Authorization=Basic <dev-api-key-base64>,Content-Type=application/x-protobuf
OBSERVABILITY_ENABLED=true
SERVICE_NAME=blog2video-backend
```

**Prod account:**

```env
DEPLOY_ENV=prod
GRAFANA_ACCOUNT=PROD

GRAFANA_PROD_OTLP_ENDPOINT=https://otlp-gateway-prod.grafana.net/otlp/v1/traces
GRAFANA_PROD_OTLP_HEADERS=Authorization=Basic <prod-api-key-base64>,Content-Type=application/x-protobuf
OBSERVABILITY_ENABLED=true
SERVICE_NAME=blog2video-backend
```

To switch accounts, change **only**:

- `GRAFANA_ACCOUNT`
- The corresponding `GRAFANA_<ACCOUNT>_OTLP_*` values.

No code changes are required.

### Backend exporters and instrumentation

On startup (`lifespan` in `backend/app/main.py`):

- `configure_logging()` from `app.observability.logging`:
  - Replaces default logging with structured logs including trace/span IDs.
- `init_tracing(app)` from `app.observability.tracing`:
  - Creates a `TracerProvider` with OTLP HTTP exporter configured via `get_otel_settings()`.
  - Instruments FastAPI, ASGI layer, and `requests` HTTP client.

Pipeline-specific spans and metrics in `app/routers/pipeline.py`:

- Root span:
  - `pipeline.run` with attributes:
    - `pipeline.project_id`
    - `pipeline.user_id`
- Child spans:
  - `pipeline.scrape_blog` (stage: `scrape`)
  - `pipeline.generate_script` (stage: `generate_script`)
  - `pipeline.generate_scenes` (stage: `generate_scenes`)
- Metrics:
  - `pipelines_started`
  - `pipelines_succeeded`
  - `pipelines_failed`

Errors are recorded on the current span (`record_exception`) and logged with correlated `trace_id`/`span_id`.

---

## Frontend configuration (React)

### Key modules

- `frontend/src/observability/otel.ts`
  - Initializes the OpenTelemetry Web SDK and OTLP exporter.
- `frontend/src/main.tsx`
  - Calls `initFrontendOtel()` **before** rendering React.

### Frontend environment variables

- `VITE_OBSERVABILITY_ENABLED`:
  - `true` / `false` (default: enabled).
- `VITE_SERVICE_NAME`:
  - Default: `blog2video-frontend`.
- `VITE_DEPLOY_ENV`:
  - Deployment environment, e.g. `dev`, `staging`, `prod`. Default: `dev`.
- `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`:
  - OTLP HTTP endpoint (can match backend’s endpoint / collector).
- `VITE_OTEL_EXPORTER_OTLP_HEADERS`:
  - Comma-separated headers string, same format as backend.
- `VITE_OTEL_DEBUG`:
  - `true` to enable browser-side OpenTelemetry debug logs.

Example `frontend/.env` entries for a dev Grafana account:

```env
VITE_OBSERVABILITY_ENABLED=true
VITE_SERVICE_NAME=blog2video-frontend
VITE_DEPLOY_ENV=dev

VITE_OTEL_EXPORTER_OTLP_ENDPOINT=https://otlp-gateway-dev.grafana.net/otlp/v1/traces
VITE_OTEL_EXPORTER_OTLP_HEADERS=Authorization=Basic <dev-api-key-base64>,Content-Type=application/x-protobuf
```

To switch Grafana accounts for the frontend, set:

- `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`
- `VITE_OTEL_EXPORTER_OTLP_HEADERS`

and rebuild/redeploy the frontend.

### Trace correlation: frontend → backend

The frontend SDK:

- Uses `FetchInstrumentation` with `propagateTraceHeaderCorsUrls: /.*/`.
- Automatically adds W3C `traceparent` and `tracestate` headers on all `fetch` calls.

The backend FastAPI instrumentation:

- Reads and continues incoming trace context from these headers.
- As a result, a single distributed trace in Grafana Tempo will include:
  - Browser spans (page load, fetch calls).
  - Backend spans (FastAPI request handling, pipeline stages).

---

## Switching between Grafana accounts

You can maintain multiple Grafana stacks (e.g. `dev`, `staging`, `prod`) and switch between them purely via env:

1. **Backend**
   - Define per-account OTLP settings:
     - `GRAFANA_DEV_OTLP_ENDPOINT`, `GRAFANA_DEV_OTLP_HEADERS`
     - `GRAFANA_STAGING_OTLP_ENDPOINT`, `GRAFANA_STAGING_OTLP_HEADERS`
     - `GRAFANA_PROD_OTLP_ENDPOINT`, `GRAFANA_PROD_OTLP_HEADERS`
   - Set:
     - `DEPLOY_ENV=<env>`
     - `GRAFANA_ACCOUNT=<matching account key>`

2. **Frontend**
   - For each environment, configure:
     - `VITE_OTEL_EXPORTER_OTLP_ENDPOINT`
     - `VITE_OTEL_EXPORTER_OTLP_HEADERS`
   - Use your deployment pipeline to inject the correct values per environment.

This supports:

- Completely separate Grafana stacks per env.
- Easy rotation of API keys without changing code.

---

## Recommended Grafana dashboards & alerts

### Key metrics and signals

Using the exported metrics and traces, build dashboards around:

- **Pipeline throughput**
  - `pipelines_started`, `pipelines_succeeded`, `pipelines_failed` (per 5m / 1h).
- **Reliability / errors**
  - Error rate: `pipelines_failed / pipelines_started`.
  - Top error messages and stages (from trace attributes and logs).
- **Performance**
  - p50 / p90 / p95 pipeline duration (from trace spans).
  - Stage-level durations for:
    - `pipeline.scrape_blog`
    - `pipeline.generate_script`
    - `pipeline.generate_scenes`
- **User / project context** (if you add attributes like `user.id`, `project.id` to spans).

### Example dashboards

1. **Pipeline Overview**
   - Panels:
     - Timeseries: `pipelines_started`, `pipelines_succeeded`, `pipelines_failed`.
     - SingleStat: success rate (`succeeded / started`).
     - Table: latest failed pipelines with:
       - `pipeline.project_id`
       - `pipeline.user_id`
       - error message (from logs or trace attributes).

2. **Pipeline Performance**
   - Panels:
     - Histogram or heatmap of pipeline duration (Tempo/Prometheus).
     - Stage duration breakdown per pipeline.
     - Top slowest projects by p95 duration.

3. **Error Drilldown**
   - Panels:
     - Logs filtered by `service.name=blog2video-backend` and `level=ERROR`.
     - Tempo search for spans with `status=ERROR` and `service.name` filters.
     - Trace-in-trace view grouped by `pipeline.stage`.

4. **Frontend UX / API health**
   - Panels:
     - Count of frontend spans per route/page.
     - API call failure rate from browser (spans with HTTP status ≥ 400).
     - Latency distribution for key API endpoints.

### Basic alert ideas

Set up alerts in Grafana based on Prometheus/Tempo queries:

- **High pipeline failure rate**
  - Condition: `pipelines_failed / pipelines_started > X%` over last 10–15 minutes.
  - Severity: warning/critical depending on threshold.

- **Slow pipelines**
  - Condition: p95 duration of `pipeline.run` spans exceeds threshold (e.g. 5–10 minutes).

- **No pipelines running**
  - Condition: `pipelines_started` == 0 over last N hours while traffic is expected.

---

## Local development

- You can disable observability locally with:

```env
OBSERVABILITY_ENABLED=false
VITE_OBSERVABILITY_ENABLED=false
```

- Or point to a local OpenTelemetry Collector using:
  - `OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces`
  - `VITE_OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318/v1/traces`

This lets you test traces, logs, and metrics without sending data to Grafana Cloud.

