import api from "../api/axios";

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  full_name: string;
  email: string;
  access_token: string;
  token_type: string;
}

export interface ForgotPasswordRequest {
  email: string;
}

export interface ForgotPasswordResponse {
  success: boolean;
  message: string;
}

export interface ResetPasswordRequest {
  token: string;
  new_password: string;
}

export interface ResetPasswordResponse {
  success: boolean;
  message: string;
}

const TOKEN_STORAGE_KEY = "phoenix_token";

export function saveToken(token: string): void {
  try {
    localStorage.setItem(TOKEN_STORAGE_KEY, token);
  } catch {
    // localStorage unavailable
  }
}

export function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function clearToken(): void {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // localStorage unavailable
  }
}

export function isTokenValid(): boolean {
  const token = readToken();

  if (!token) return false;

  const parts = token.split(".");

  if (parts.length !== 3) return false;

  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );

    if (typeof payload.exp !== "number") return false;

    return payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const login = async (
  credentials: LoginRequest
): Promise<LoginResponse> => {

  const response = await api.post<LoginResponse>(
    "/auth/login",
    credentials
  );

  return response.data;
};

export const forgotPassword = async (
  request: ForgotPasswordRequest
): Promise<ForgotPasswordResponse> => {

  const response = await api.post<ForgotPasswordResponse>(
    "/auth/forgot-password",
    request
  );

  return response.data;
};

export const resetPassword = async (
  request: ResetPasswordRequest
): Promise<ResetPasswordResponse> => {

  const response = await api.post<ResetPasswordResponse>(
    "/auth/reset-password",
    request
  );

  return response.data;
};