// src/app/core/services/sale.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import { Sale, CreateSaleRequest, SaleFilters } from '../models/sale';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class SaleService {
  private readonly apiUrl = `${environment.apiUrl}/sales`;

  constructor(private http: HttpClient) {}

  getSales(filters?: SaleFilters, page = 0, size = 20): Observable<ApiResponse<any>> {
    let params = new HttpParams()
      .set('page', page.toString())
      .set('size', size.toString());

    if (filters?.customerId)    params = params.set('customerId',    filters.customerId);
    if (filters?.status)        params = params.set('status',        filters.status);
    if (filters?.paymentMethod) params = params.set('paymentMethod', filters.paymentMethod);
    if (filters?.paymentStatus) params = params.set('paymentStatus', filters.paymentStatus);
    if (filters?.dateFrom)      params = params.set('dateFrom',      filters.dateFrom!);
    if (filters?.dateTo)        params = params.set('dateTo',        filters.dateTo!);

    return this.http.get<any>(this.apiUrl, { params }).pipe(
      map((response) => {
        const paged = response.data;
        return {
          success: true,
          data: {
            content:       paged.content.map((r: any) => this.mapToSale(r)),
            page:          paged.page,
            totalPages:    paged.totalPages,
            totalElements: paged.totalElements,
            size:          paged.size || size,
            totals:        paged.totals ?? { total_revenue: 0, total_cost: 0, total_profit: 0 },
          }
        };
      })
    );
  }

  private mapToSale(raw: any): Sale {
    return {
      saleId:            raw._id,
      saleNo:            raw.sale_no,
      customerId:        raw.customer_id?._id  || raw.customer_id || '',
      customerName:      raw.customer_id?.name || '',
      customerCode:      raw.customer_id?.customer_code || '',
      createdByUserName: raw.created_by_user_id?.full_name || raw.created_by_user_id?.username || '',
      saleDatetime:      raw.sale_datetime,
      paymentMethod:     raw.payment_method,
      paymentStatus:     raw.payment_status ?? 'PAID',
      status:            raw.status,
      totalRevenue:      raw.total_revenue  ?? 0,
      totalCost:         raw.total_cost     ?? 0,
      totalProfit:       raw.total_profit   ?? 0,
      totalPaid:         raw.total_paid     ?? 0,
      items: (raw.items ?? []).map((item: any) => ({
        saleItemId:     item._id,
        packTypeId:     item.pack_type_id?._id  || item.pack_type_id,
        packName:       item.pack_type_id?.pack_name || '',
        weightKg:       item.pack_type_id?.weight_kg ?? null,
        qty:            item.qty,
        unitPriceSold:  item.unit_price_sold,
        unitCostAtSale: item.unit_cost_at_sale,
        lineRevenue:    item.line_revenue,
        lineCost:       item.line_cost,
        lineProfit:     item.line_profit,
      }))
    };
  }

  getById(saleId: string): Observable<ApiResponse<Sale>> {
    return this.http.get<any>(`${this.apiUrl}/${saleId}`).pipe(
      map((response) => ({
        success: true,
        data: this.mapToSale(response.data || response)
      }))
    );
  }

  createSale(request: CreateSaleRequest): Observable<ApiResponse<Sale>> {
    const payload = {
      customer_id:    request.customerId,
      payment_method: request.paymentMethod,
      sale_datetime:  request.saleDate ? new Date(request.saleDate).toISOString() : undefined,
      items: request.items.map(item => ({
        pack_type_id:    item.packTypeId,
        qty:             item.qty,
        unit_price_sold: item.unitPriceSold
      }))
    };
    return this.http.post<any>(this.apiUrl, payload).pipe(
      map((response) => ({ success: true, data: this.mapToSale(response.data || response) }))
    );
  }

  updateSale(saleId: string, request: CreateSaleRequest): Observable<ApiResponse<Sale>> {
    const payload = {
      customer_id:    request.customerId,
      payment_method: request.paymentMethod,
      sale_datetime:  request.saleDate ? `${request.saleDate}T00:00:00.000Z` : undefined,
      items: request.items.map(item => ({
        pack_type_id:    item.packTypeId,
        qty:             item.qty,
        unit_price_sold: item.unitPriceSold
      }))
    };
    return this.http.patch<any>(`${this.apiUrl}/${saleId}`, payload).pipe(
      map((response) => ({ success: true, data: this.mapToSale(response.data || response) }))
    );
  }

  cancelSale(saleId: string): Observable<ApiResponse<Sale>> {
    return this.http.patch<ApiResponse<Sale>>(`${this.apiUrl}/${saleId}/cancel`, {});
  }

  markAsPaid(saleId: string): Observable<ApiResponse<Sale>> {
    return this.http.patch<any>(`${this.apiUrl}/${saleId}/mark-paid`, {}).pipe(
      map((response) => ({ success: true, data: this.mapToSale(response.data || response) }))
    );
  }

  deleteSale(saleId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${saleId}`);
  }
}