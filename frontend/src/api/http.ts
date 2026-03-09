import axios from "axios";

// In production, VITE_BACKEND_URL points to the Cloud Run backend.
// In local dev it's empty — Vite proxy handles /api and /media routing.
const viteEnv =
  typeof import.meta !== "undefined" ? import.meta.env : undefined;
const processEnv =
  typeof globalThis !== "undefined" && "process" in globalThis
    ? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env
    : undefined;

export const BACKEND_URL = viteEnv?.VITE_BACKEND_URL || processEnv?.VITE_BACKEND_URL || "";

const api = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// ─── Auth interceptor ─────────────────────────────────────

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("b2v_token");
  if (token) {
    config.headers.Authorization = `Bearer token`.replace("token", token);
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("b2v_token");
      localStorage.removeItem("b2v_user");
      // Only redirect if not already on landing/login page
      if (
        window.location.pathname !== "/" &&
        window.location.pathname !== "/pricing"
      ) {
        window.location.href = "/";
      }
    }
    return Promise.reject(err);
  }
);

export default api;

