/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_CLIENT_ID: string;
  readonly VITE_BACKEND_URL: string;
  /** GA4 property id. Consumed by index.html via %VITE_GA4_MEASUREMENT_ID%, not by app code. */
  readonly VITE_GA4_MEASUREMENT_ID?: string;
  readonly VITE_GOOGLE_ADS_ID?: string;
  readonly VITE_GOOGLE_ADS_PURCHASE_LABEL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
