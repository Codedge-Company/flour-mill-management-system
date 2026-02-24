
export interface User {
  userId: number;
  fullName: string;
  username: string;
  role: 'ADMIN' | 'SALES';
  createdAt: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface LoginRequest {
  username: string;
  password: string;
}