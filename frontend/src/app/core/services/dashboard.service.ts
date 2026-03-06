// src/app/core/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import { ApiResponse } from '../models/api-response';
import { DashboardData, DateRange } from '../models/dashboard';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getData(range: DateRange): Observable<ApiResponse<DashboardData>> {
    const params = new HttpParams()
      .set('dateFrom', range.dateFrom)
      .set('dateTo',   range.dateTo);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map(raw => ({
        success: true,
        data: {
          summary: {
            totalRevenue: raw.summary?.total_revenue ?? 0,
            totalCost:    raw.summary?.total_cost    ?? 0,
            totalProfit:  raw.summary?.total_profit  ?? 0,
            totalSales:   raw.summary?.total_sales   ?? 0,
          },
          dailyMetrics: (raw.daily_metrics ?? []).map((m: any) => ({
            date:    m.date,
            revenue: m.revenue ?? 0,
            cost:    m.cost    ?? 0,
            profit:  m.profit  ?? 0,
          })),
          customerPerformance: (raw.customer_performance ?? []).map((c: any) => ({
            customerName: c.customer_name ?? '',
            revenue:      c.revenue       ?? 0,
            salesCount:   c.sales_count   ?? 0,
          })),
        }
      }))
    );
  }

  getSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/summary`);
  }

  // ── Local date helper (avoids UTC offset shifting the date) ──────────────
  // Use this everywhere you format a Date → 'YYYY-MM-DD' for API calls
  static fmtLocal(d: Date): string {
    const y  = d.getFullYear();
    const m  = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${dd}`;
  }
}