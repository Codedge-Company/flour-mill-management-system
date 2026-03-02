// src/app/core/services/user.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export interface CreateUserDto {
  full_name: string;
  username: string;
  password: string;
  role: 'SALES' | 'ADMIN';
}

export interface UpdateUserDto {
  full_name?: string;
  username?: string;
  password?: string;
  role?: 'SALES' | 'ADMIN';
}

export interface UserResponse {
  id: string;
  full_name: string;
  username: string;
  role: 'SALES' | 'ADMIN';
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private apiUrl = `${environment.apiUrl}/users`;

  constructor(private http: HttpClient) { }

  private get authHeaders() {
    const token = localStorage.getItem('token');
    return { Authorization: `Bearer ${token}` };
  }

  getAllUsers(): Observable<UserResponse[]> {
    return this.http
      .get<{ success: boolean; data: UserResponse[] }>(this.apiUrl, {
        headers: this.authHeaders
      })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  createUser(user: CreateUserDto): Observable<UserResponse> {
    return this.http
      .post<{ success: boolean; data: UserResponse }>(this.apiUrl, user, {
        headers: this.authHeaders
      })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  updateUser(id: string, dto: UpdateUserDto): Observable<UserResponse> {
    return this.http
      .put<{ success: boolean; data: UserResponse }>(`${this.apiUrl}/${id}`, dto, {
        headers: this.authHeaders
      })
      .pipe(map(res => res.data), catchError(this.handleError));
  }

  deleteUser(id: string): Observable<void> {
    return this.http
      .delete<{ success: boolean }>(`${this.apiUrl}/${id}`, {
        headers: this.authHeaders
      })
      .pipe(map(() => void 0), catchError(this.handleError));
  }

  private handleError(error: any) {
    console.error('An error occurred:', error);
    let errorMessage = 'An unexpected error occurred. Please try again.';
    if (error.error?.message) errorMessage = error.error.message;
    else if (error.status === 400) errorMessage = 'Invalid data provided. Please check your input.';
    else if (error.status === 409) errorMessage = 'Username already exists. Please choose another.';
    else if (error.status === 404) errorMessage = 'User not found.';
    else if (error.status === 0) errorMessage = 'Cannot connect to server. Is the backend running?';
    return throwError(() => new Error(errorMessage));
  }
}