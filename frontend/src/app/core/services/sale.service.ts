// src/app/core/services/sale.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  Sale,
  CreateSaleRequest,
  SaleFilters
} from '../models/sale';
import { ApiResponse, PagedResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly apiUrl = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) {}

  getSales(filters?: SaleFilters, page = 0, size = 20): Observable<ApiResponse<PagedResponse<Sale>>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters?.customerId) params = params.set('customerId', filters.customerId.toString());
    if (filters?.status)     params = params.set('status', filters.status);
    if (filters?.dateFrom)   params = params.set('dateFrom', filters.dateFrom);
    if (filters?.dateTo)     params = params.set('dateTo', filters.dateTo);

    return this.http.get<ApiResponse<PagedResponse<Sale>>>(this.apiUrl, { params });
  }

  getById(saleId: number): Observable<ApiResponse<Sale>> {
    return this.http.get<ApiResponse<Sale>>(`${this.apiUrl}/${saleId}`);
  }

  createSale(request: CreateSaleRequest): Observable<ApiResponse<Sale>> {
    return this.http.post<ApiResponse<Sale>>(this.apiUrl, request);
  }

  cancelSale(saleId: number): Observable<ApiResponse<Sale>> {
    return this.http.patch<ApiResponse<Sale>>(
      `${this.apiUrl}/${saleId}/cancel`, {}
    );
  }
}