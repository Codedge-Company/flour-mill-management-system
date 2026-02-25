
export interface User {
  userId: number;
  fullName: string;
  username: string;
  role: 'ADMIN' | 'SALES';
  createdAt: string;
}

export interface SuccessAuthResponse {
  token: string;
  user: User;
}

export interface ErrorAuthResponse {
  message?: string; 
}
export interface LoginRequest {
  username: string;
  password: string;
}
export type AuthResponse = SuccessAuthResponse | ErrorAuthResponse;
export type BackendResponse = { data: SuccessAuthResponse } | ErrorAuthResponse;  