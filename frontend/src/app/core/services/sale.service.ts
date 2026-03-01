// src/app/core/services/sale.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
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

  constructor(private http: HttpClient) { }

  getSales(filters?: SaleFilters, page = 0, size = 20): Observable<ApiResponse<any>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    // Transform camelCase → snake_case for backend
    if (filters?.customerId) params = params.set('customerId', filters.customerId);
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.dateFrom) params = params.set('dateFrom', filters.dateFrom!);
    if (filters?.dateTo) params = params.set('dateTo', filters.dateTo!);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((response) => {
        // Transform backend PagedResponse → frontend format
        const paged = response.data;
        return {
          success: true,
          data: {
            content: paged.content.map(this.mapToSale),
            page: paged.page,
            totalPages: paged.totalPages,
            totalElements: paged.totalElements,
            size: paged.size || size
          }
        };
      })
    );
  }

  private mapToSale(raw: any): Sale {
    return {
      saleId: raw._id,
      saleNo: raw.sale_no,
      customerId: raw.customer_id?._id || raw.customer_id || '',
      customerName: raw.customer_id?.name || '',
      customerCode: raw.customer_id?.customer_code || '',
      createdByUserName: raw.created_by_user_id?.full_name || raw.created_by_user_id?.username || '',
      saleDatetime: raw.sale_datetime,
      paymentMethod: raw.payment_method,
      status: raw.status,
      totalRevenue: raw.total_revenue,
      totalCost: raw.total_cost,
      totalProfit: raw.total_profit,
      items: raw.items.map((item: any) => ({
        saleItemId: item._id,
        packTypeId: item.pack_type_id?._id || item.pack_type_id,
        packName: item.pack_type_id?.pack_name || '',
        qty: item.qty,
        unitPriceSold: item.unit_price_sold,
        unitCostAtSale: item.unit_cost_at_sale,
        lineRevenue: item.line_revenue,
        lineCost: item.line_cost,
        lineProfit: item.line_profit
      }))
    };
  }


  getById(saleId: string): Observable<ApiResponse<Sale>> {
    return this.http.get<any>(`${this.apiUrl}/${saleId}`).pipe(
      map((response) => {
        console.log('getById raw:', response);
        return {
          success: true,
          data: this.mapToSale(response.data || response)  // Handle raw/wrapped
        };
      })
    );
  }


  createSale(request: CreateSaleRequest): Observable<ApiResponse<Sale>> {
    // Transform camelCase → snake_case
    const payload = {
      customer_id: request.customerId,
      payment_method: request.paymentMethod,
      items: request.items.map(item => ({
        pack_type_id: item.packTypeId,
        qty: item.qty,
        unit_price_sold: item.unitPriceSold  
      }))
    };

    return this.http.post<any>(this.apiUrl, payload).pipe(
      map((response) => ({
        success: true,
        data: this.mapToSale(response.data || response)
      }))
    );
  }

  cancelSale(saleId: string): Observable<ApiResponse<Sale>> {
    return this.http.patch<ApiResponse<Sale>>(
      `${this.apiUrl}/${saleId}/cancel`, {}
    );
  }
}