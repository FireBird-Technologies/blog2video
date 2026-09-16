/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  /** Apple *Services ID* (not the App ID), e.g. "com.firebird.blog2video.web". */
  readonly VITE_APPLE_CLIENT_ID?: string;
  /** Entra ID app registration's Application (client) ID. */
  readonly VITE_MICROSOFT_CLIENT_ID?: string;
  readonly VITE_BACKEND_URL: string;
  readonly VITE_BLOG2VIDEO_URL: string;
  /** GA4 property id. Consumed by index.html via %VITE_GA4_MEASUREMENT_ID%, not by app code. */
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
  readonly VITE_GOOGLE_ADS_PURCHASE_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
