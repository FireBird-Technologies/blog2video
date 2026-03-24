import { WebTracerProvider } from "@opentelemetry/sdk-trace-web";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { registerInstrumentations } from "@opentelemetry/instrumentation";
import { FetchInstrumentation } from "@opentelemetry/instrumentation-fetch";
import { DocumentLoadInstrumentation } from "@opentelemetry/instrumentation-document-load";
import { Resource } from "@opentelemetry/resources";
import { SemanticResourceAttributes } from "@opentelemetry/semantic-conventions";
import { diag, DiagConsoleLogger, DiagLogLevel } from "@opentelemetry/api";

let initialized = false;

function parseHeaders(raw: string | undefined): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  raw
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)
    .forEach((part) => {
      const [k, v] = part.split("=", 2);
      if (k && v) out[k.trim()] = v.trim();
    });
  return out;
}

export function initFrontendOtel() {
  if (initialized) return;

  const enabled =
    (import.meta.env.VITE_OBSERVABILITY_ENABLED ?? "true").toLowerCase() !==
    "false";
  if (!enabled) {
    initialized = true;
    return;
  }

  const endpoint = import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT;
  if (!endpoint) {
    initialized = true;
    return;
  }

  const serviceName =
    import.meta.env.VITE_SERVICE_NAME ?? "blog2video-frontend";
  const environment = import.meta.env.VITE_DEPLOY_ENV ?? "dev";

  // Optional client-side debug
  if (import.meta.env.VITE_OTEL_DEBUG === "true") {
    diag.setLogger(new DiagConsoleLogger(), DiagLogLevel.DEBUG);
  }

  const provider = new WebTracerProvider({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: environment,
    }),
  });

  const headers = parseHeaders(
    import.meta.env.VITE_OTEL_EXPORTER_OTLP_HEADERS,
  );

  const exporter = new OTLPTraceExporter({
    url: endpoint,
    headers,
  });

  provider.addSpanProcessor(new BatchSpanProcessor(exporter));
  provider.register();

  registerInstrumentations({
    instrumentations: [
      new DocumentLoadInstrumentation(),
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: /.*/,
      }),
    ],
  });

  initialized = true;
}

