import axios from "axios";

/**
 * Base URL for the FastAPI backend.
 *
 * Override using VITE_API_BASE_URL in a .env file.
 * Defaults to the local FastAPI backend.
 */
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://127.0.0.1:1992";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export default api;
