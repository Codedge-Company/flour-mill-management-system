// src/app/core/services/dashboard.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  DashboardData,
  DashboardSummary,
  DateRange,
  CustomerPerformance,
  DailyMetric
} from '../models/dashboard';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly apiUrl = `${environment.apiUrl}/dashboard`;

  constructor(private http: HttpClient) {}

  getData(range: DateRange): Observable<ApiResponse<DashboardData>> {
    const params = new HttpParams()
      .set('dateFrom', range.dateFrom)
      .set('dateTo', range.dateTo);
    return this.http.get<ApiResponse<DashboardData>>(this.apiUrl, { params });
  }

  getSummary(range: DateRange): Observable<ApiResponse<DashboardSummary>> {
    const params = new HttpParams()
      .set('dateFrom', range.dateFrom)
      .set('dateTo', range.dateTo);
    return this.http.get<ApiResponse<DashboardSummary>>(
      `${this.apiUrl}/summary`, { params }
    );
  }

  getCustomerPerformance(range: DateRange): Observable<ApiResponse<CustomerPerformance[]>> {
    const params = new HttpParams()
      .set('dateFrom', range.dateFrom)
      .set('dateTo', range.dateTo);
    return this.http.get<ApiResponse<CustomerPerformance[]>>(
      `${this.apiUrl}/customer-performance`, { params }
    );
  }

  getDailyMetrics(range: DateRange): Observable<ApiResponse<DailyMetric[]>> {
    const params = new HttpParams()
      .set('dateFrom', range.dateFrom)
      .set('dateTo', range.dateTo);
    return this.http.get<ApiResponse<DailyMetric[]>>(
      `${this.apiUrl}/daily-metrics`, { params }
    );
  }
}