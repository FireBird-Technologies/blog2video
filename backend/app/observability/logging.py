import logging
import sys
from typing import Any, Dict

from opentelemetry import trace

from .config import get_otel_settings


class OtelJsonFormatter(logging.Formatter):
    """Simple JSON-ish formatter that injects trace/span ids when present."""

    def format(self, record: logging.LogRecord) -> str:
        span = trace.get_current_span()
        span_ctx = span.get_span_context() if span is not None else None

        payload: Dict[str, Any] = {
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }

        # Optional structured context (used for filtering in Grafana)
        project_id = getattr(record, "project_id", None)
        user_id = getattr(record, "user_id", None)
        if project_id is not None:
            payload["project_id"] = project_id
        if user_id is not None:
            payload["user_id"] = user_id

        if span_ctx and span_ctx.is_valid:
            payload["trace_id"] = format(span_ctx.trace_id, "032x")
            payload["span_id"] = format(span_ctx.span_id, "016x")

        if record.exc_info:
            payload["exc_info"] = self.formatException(record.exc_info)

        # Keep it simple: no external JSON dependency, just a stable repr
        return str(payload)


_LOGS_INITIALIZED = False


def init_log_export() -> None:
    """
    Send Python logging to Grafana Cloud Logs (OTLP).
    Call after configure_logging(); no-op if observability disabled or no logs endpoint.
    """
    global _LOGS_INITIALIZED
    if _LOGS_INITIALIZED:
        return

    settings = get_otel_settings()
    if not settings.enabled or not settings.otlp_headers:
        _LOGS_INITIALIZED = True
        return

    logs_endpoint = settings.otlp_logs_endpoint
    if not logs_endpoint:
        _LOGS_INITIALIZED = True
        return

    try:
        from opentelemetry._logs import set_logger_provider
        from opentelemetry.sdk._logs import LoggerProvider
        from opentelemetry.sdk._logs.export import BatchLogRecordProcessor
        from opentelemetry.sdk.resources import Resource
        from opentelemetry.exporter.otlp.proto.http._log_exporter import OTLPLogExporter
    except ImportError:
        _LOGS_INITIALIZED = True
        return

    resource = Resource.create(
        {
            "service.name": settings.service_name,
            "deployment.environment": settings.environment,
        }
    )
    logger_provider = LoggerProvider(resource=resource)
    exporter = OTLPLogExporter(
        endpoint=logs_endpoint,
        headers=settings.otlp_headers,
    )
    logger_provider.add_log_record_processor(BatchLogRecordProcessor(exporter))
    set_logger_provider(logger_provider)

    try:
        from opentelemetry.instrumentation.logging import LoggingInstrumentor
        LoggingInstrumentor().instrument(set_logging_format=True)
    except Exception:
        pass

    _LOGS_INITIALIZED = True


def configure_logging() -> None:
    """
    Configure root logging: stdout with trace context, and OTLP log export when enabled.
    """
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(OtelJsonFormatter())

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    for h in list(root.handlers):
        root.removeHandler(h)
    root.addHandler(handler)

    init_log_export()


def get_logger(name: str) -> logging.Logger:
    return logging.getLogger(name)

