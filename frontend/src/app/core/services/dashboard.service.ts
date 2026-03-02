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

  constructor(private http: HttpClient) { }


  getData(range: DateRange): Observable<ApiResponse<DashboardData>> {
    const params = new HttpParams()
      .set('dateFrom', range.dateFrom)
      .set('dateTo', range.dateTo);

    return this.http.get<any>(`${this.apiUrl}`, { params }).pipe(
      map((rawResponse) => {
        console.log('Raw dashboard response:', rawResponse); // Debug
        // Backend returns: { summary, daily_metrics, customer_performance }
        // Transform snake_case → camelCase
        return {
          success: true,
          data: {
            summary: {
              totalRevenue: rawResponse.summary?.total_revenue || 0,
              totalCost: rawResponse.summary?.total_cost || 0,
              totalProfit: rawResponse.summary?.total_profit || 0,
              totalSales: rawResponse.summary?.total_sales || 0
            },
            dailyMetrics: (rawResponse.daily_metrics || []).map((m: any) => ({
              date: m.date,
              revenue: m.revenue || 0,
              cost: m.cost || 0,
              profit: m.profit || 0
            })),
            customerPerformance: (rawResponse.customer_performance || []).map((c: any) => ({
              customerName: c.customer_name || '',
              revenue: c.revenue || 0,
              salesCount: c.sales_count || 0
            }))
          }
        };
      })
    );
  }

  getSummary(): Observable<ApiResponse<any>> {
    return this.http.get<ApiResponse<any>>(`${this.apiUrl}/summary`);
  }
}
