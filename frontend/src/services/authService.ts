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