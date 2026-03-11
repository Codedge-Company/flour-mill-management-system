// src/app/core/services/budget.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.prod';

export interface BudgetAmount {
  amount: number;
  label:  string;
}

export interface BudgetSummary {
  budget: BudgetAmount & { updatedAt: string | null };
  expenditures: any[];
  summary: {
    totalBudget:  number;
    totalSpent:   number;
    balance:      number;
    spentPercent: number;
    count:        number;
  };
}

interface ApiResponse<T> { success: boolean; data: T; message?: string; }

@Injectable({ providedIn: 'root' })
export class BudgetService {
  private readonly base = `${environment.apiUrl}/budget`;

  constructor(private http: HttpClient) {}

  /** Full summary: budget + all expenditures + computed totals */
  getSummary(): Observable<BudgetSummary> {
    return this.http.get<ApiResponse<BudgetSummary>>(this.base).pipe(
      map(r => r.data)
    );
  }

  /** Lightweight: just the budget amount */
  getAmount(): Observable<BudgetAmount> {
    return this.http.get<ApiResponse<BudgetAmount>>(`${this.base}/amount`).pipe(
      map(r => r.data)
    );
  }

  /** Save / update the budget amount in the database */
  update(amount: number, label?: string): Observable<BudgetAmount> {
    return this.http.put<ApiResponse<BudgetAmount>>(this.base, { amount, label }).pipe(
      map(r => r.data)
    );
  }
}