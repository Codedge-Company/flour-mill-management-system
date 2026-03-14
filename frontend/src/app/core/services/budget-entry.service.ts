// src/app/core/services/budget-entry.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import { BudgetEntry, CreateBudgetEntryDto } from '../models/budget-entry';
@Injectable({ providedIn: 'root' })
export class BudgetEntryService {
  private readonly apiUrl = `${environment.apiUrl}/budget-entries`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ data: BudgetEntry[] }> {
    return this.http.get<any>(this.apiUrl).pipe(
      map(res => ({
        data: (Array.isArray(res) ? res : (res?.data ?? [])).map(this.map)
      }))
    );
  }

  create(dto: CreateBudgetEntryDto): Observable<{ data: BudgetEntry }> {
    return this.http.post<any>(this.apiUrl, dto).pipe(
      map(res => ({ data: this.map(res?.data ?? res) }))
    );
  }

  update(id: string, dto: CreateBudgetEntryDto): Observable<{ data: BudgetEntry }> {
    return this.http.patch<any>(`${this.apiUrl}/${id}`, dto).pipe(
      map(res => ({ data: this.map(res?.data ?? res) }))
    );
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  private map(raw: any): BudgetEntry {
    return {
      _id:         raw._id         ?? raw.id ?? '',
      description: raw.description ?? '',
      amount:      raw.amount      ?? 0,
      date:        raw.date        ?? raw.createdAt ?? new Date().toISOString(),
      createdAt:   raw.createdAt,
    };
  }
}