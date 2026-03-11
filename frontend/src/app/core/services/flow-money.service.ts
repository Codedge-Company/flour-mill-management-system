// src/app/core/services/flow-money.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import { ApiResponse } from '../models/api-response';
import {
  FlowMoneyData, CapitalEntry, AddCapitalRequest
} from '../models/flow-money';

@Injectable({ providedIn: 'root' })
export class FlowMoneyService {
  private readonly baseUrl = `${environment.apiUrl}/capital`;

  constructor(private http: HttpClient) {}

  /** Full timeline + summary. dateFrom / dateTo are optional YYYY-MM-DD. */
  getFlow(dateFrom?: string, dateTo?: string): Observable<ApiResponse<FlowMoneyData>> {
    let params = new HttpParams();
    if (dateFrom) params = params.set('dateFrom', dateFrom);
    if (dateTo)   params = params.set('dateTo',   dateTo);

    return this.http.get<any>(`${this.baseUrl}/flow`, { params }).pipe(
      map(res => ({ success: true, data: res.data as FlowMoneyData }))
    );
  }

  /** All capital entries */
  getCapitals(): Observable<ApiResponse<CapitalEntry[]>> {
    return this.http.get<any>(this.baseUrl).pipe(
      map(res => ({ success: true, data: res.data as CapitalEntry[] }))
    );
  }

  /** Add a new capital injection */
  addCapital(req: AddCapitalRequest): Observable<ApiResponse<CapitalEntry>> {
    return this.http.post<any>(this.baseUrl, {
      amount:       req.amount,
      label:        req.label,
      capital_date: req.capital_date,
      note:         req.note,
    }).pipe(
      map(res => ({ success: true, data: res.data as CapitalEntry }))
    );
  }

  /** Delete a capital entry */
  deleteCapital(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }

  /** Format Date → 'YYYY-MM-DD' in local time */
  static fmtLocal(d: Date): string {
    return [
      d.getFullYear(),
      String(d.getMonth() + 1).padStart(2, '0'),
      String(d.getDate()).padStart(2, '0'),
    ].join('-');
  }
}