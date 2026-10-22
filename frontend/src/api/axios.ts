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

/*
 * Attach the JWT bearer token (stored at login) to every
 * request. A flipped localStorage flag alone no longer
 * reaches the API: the backend verifies the signature.
 */
api.interceptors.request.use((config) => {
  try {
    const token = localStorage.getItem("phoenix_token");

    if (token) {
      config.headers.set("Authorization", `Bearer ${token}`);
    }
  } catch {
    // localStorage unavailable
  }

  return config;
});

/*
 * Expired/revoked tokens surface as 401. Drop the token and
 * bounce to /login instead of rendering broken pages.
 */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      typeof window !== "undefined" &&
      window.location.pathname !== "/login"
    ) {
      try {
        localStorage.removeItem("phoenix_token");
      } catch {
        // localStorage unavailable
      }

      window.location.href = "/login";
    }

    return Promise.reject(error);
  }
);

export default api;
