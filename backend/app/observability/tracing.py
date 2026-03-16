from typing import Optional

from opentelemetry import trace
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, SimpleSpanProcessor
from opentelemetry.trace import set_tracer_provider
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.asgi import OpenTelemetryMiddleware
from opentelemetry.instrumentation.requests import RequestsInstrumentor

from .config import get_otel_settings


_INITIALIZED = False


def init_tracing(app) -> None:
    """
    Initialize OpenTelemetry tracing for the FastAPI app.

    This is safe to call multiple times (no-op after first init).
    """
    global _INITIALIZED
    if _INITIALIZED:
        return

    settings = get_otel_settings()
    if not settings.enabled or not settings.otlp_endpoint:
        # Leave global tracer provider as default no-op
        _INITIALIZED = True
        return

    resource = Resource.create(
        {
            "service.name": settings.service_name,
            "deployment.environment": settings.environment,
        }
    )

    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(
        endpoint=settings.otlp_endpoint,
        headers=settings.otlp_headers,
    )
    processor: BatchSpanProcessor | SimpleSpanProcessor = BatchSpanProcessor(exporter)
    provider.add_span_processor(processor)

    set_tracer_provider(provider)
    trace.set_tracer_provider(provider)

    # Instrument FastAPI / ASGI and outbound HTTP
    FastAPIInstrumentor.instrument_app(app)
    app.add_middleware(OpenTelemetryMiddleware)
    RequestsInstrumentor().instrument()

    _INITIALIZED = True

