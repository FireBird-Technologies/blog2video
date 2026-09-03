import api from "./http";
import { AuthResponse, PublicConfig, UserInfo } from "./types";

// ─── Auth API ─────────────────────────────────────────────

export const googleLogin = (credential: string) =>
  api.post<AuthResponse>("/auth/google", { credential });

export const getMe = () => api.get<UserInfo>("/auth/me");

export const logoutCleanup = () => api.post("/auth/logout");

export const getPublicConfig = () => api.get<PublicConfig>("/config/public");

