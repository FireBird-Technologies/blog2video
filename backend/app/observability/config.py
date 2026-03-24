"""
Observability config: reads from environment (e.g. backend .env).

Variables used when GRAFANA_ACCOUNT=DEV (or unset with DEPLOY_ENV=dev):
  DEPLOY_ENV, OBSERVABILITY_ENABLED, SERVICE_NAME,
  GRAFANA_ACCOUNT,
  GRAFANA_DEV_OTLP_ENDPOINT, GRAFANA_DEV_OTLP_HEADERS
"""
import os
from dataclasses import dataclass
from typing import Dict, Optional


def _logs_endpoint_from_traces(traces_endpoint: Optional[str]) -> Optional[str]:
    """Derive OTLP logs endpoint from traces endpoint (Grafana Cloud uses same base + /v1/logs)."""
    if not traces_endpoint:
        return None
    s = traces_endpoint.rstrip("/")
    if s.endswith("/v1/traces"):
        return s[: -len("/v1/traces")] + "/v1/logs"
    return s + "/v1/logs" if not s.endswith("/v1/logs") else s


@dataclass
class OtelSettings:
    """Resolved OpenTelemetry settings for this service."""

    enabled: bool
    service_name: str
    environment: str
    otlp_endpoint: Optional[str]
    otlp_headers: Dict[str, str]

    @property
    def otlp_logs_endpoint(self) -> Optional[str]:
        """OTLP endpoint for logs (derived from traces endpoint if not set)."""
        return _logs_endpoint_from_traces(self.otlp_endpoint)


def _get_bool(name: str, default: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


def _parse_headers(raw: str | None) -> Dict[str, str]:
    """
    Parse OTLP headers from either:
    - key1=val1,key2=val2
    - or a literal header string passed through (e.g. \"Authorization=Basic ...\").
    """
    if not raw:
        return {}
    parts = [p.strip() for p in raw.split(",") if p.strip()]
    out: Dict[str, str] = {}
    for part in parts:
        if "=" not in part:
            continue
        k, v = part.split("=", 1)
        out[k.strip()] = v.strip()
    return out


def get_otel_settings() -> OtelSettings:
    """
    Resolve effective OTEL settings, supporting multiple Grafana accounts.

    Environment variables:
    - OBSERVABILITY_ENABLED: toggle all OTel on/off (default: true in non-local).
    - SERVICE_NAME: logical service name (default: \"blog2video-backend\").
    - DEPLOY_ENV: deployment environment, e.g. dev/staging/prod (default: \"dev\").
    - GRAFANA_ACCOUNT: logical account key, e.g. dev|staging|prod (default: value of DEPLOY_ENV).
    - GRAFANA_<ACCOUNT>_OTLP_ENDPOINT: OTLP HTTP endpoint for that account.
    - GRAFANA_<ACCOUNT>_OTLP_HEADERS: comma-separated headers for that account.

    Fallbacks:
    - OTEL_EXPORTER_OTLP_ENDPOINT / OTEL_EXPORTER_OTLP_HEADERS if per-account vars are not set.
    """
    deploy_env = os.getenv("DEPLOY_ENV", "dev")
    # For local dev it's common to switch off tracing by default
    default_enabled = deploy_env not in {"local", "dev-local"}
    enabled = _get_bool("OBSERVABILITY_ENABLED", default_enabled)

    service_name = os.getenv("SERVICE_NAME", "blog2video-backend")
    account = os.getenv("GRAFANA_ACCOUNT", deploy_env).upper()

    account_endpoint = os.getenv(f"GRAFANA_{account}_OTLP_ENDPOINT")
    account_headers_raw = os.getenv(f"GRAFANA_{account}_OTLP_HEADERS")

    endpoint = account_endpoint or os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT")
    headers_raw = account_headers_raw or os.getenv("OTEL_EXPORTER_OTLP_HEADERS")

    headers = _parse_headers(headers_raw)

    return OtelSettings(
        enabled=enabled,
        service_name=service_name,
        environment=deploy_env,
        otlp_endpoint=endpoint,
        otlp_headers=headers,
    )

