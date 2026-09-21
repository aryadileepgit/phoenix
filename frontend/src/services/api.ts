import axios from "axios";

/**
 * Centralized PHOENIX API client.
 *
 * Single source of truth for the backend base URL.
 * Override with VITE_API_BASE_URL in frontend/.env.
 * Defaults to the local FastAPI backend.
 *
 * NOTE: src/api/axios.ts exposes the same instance for the
 * auth service. New code should import from "@/services/api"
 * (or relative "./api") instead of creating new axios instances.
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:1992";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
  timeout: 60000,
});

/** Backwards-compatible alias for the shared client. */
export const apiClient = api;

export default api;