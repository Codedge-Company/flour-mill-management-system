import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import { ApiResponse } from '../models/api-response';

export interface StockRequestPayload {
  packTypeId: string;
  packName: string;
  weightKg: number;
  qty: number;
}

export interface StockRequestFulfillment {
  qty: number;
  date: string;
  operatorName?: string | null;
}

export interface StockRequest {
  stockRequestId: string;
  packTypeId: string;
  packName: string;
  weightKg: number;
  qty: number;                              // original requested qty (fixed)
  fulfilledQty: number;                     // ← NEW: total packed so far
  remainingQty: number;                     // ← NEW: qty - fulfilledQty
  fulfillments: StockRequestFulfillment[];  // ← NEW: dated part entries
  requestedAt: string;
  status: string;
  operatorName?: string | null;
}

export interface FulfillResult extends ApiResponse<StockRequest> {
  isNowComplete: boolean;
}

@Injectable({ providedIn: 'root' })
export class StockRequestService {
  private readonly requestStoreUrl = `${environment.apiUrl}/stock-requests`;

  constructor(private http: HttpClient) { }

  createRequest(payload: StockRequestPayload): Observable<ApiResponse<StockRequest>> {
    return this.http.post<any>(this.requestStoreUrl, {
      pack_type_id: payload.packTypeId,
      pack_name: payload.packName,
      weight_kg: payload.weightKg,
      qty: payload.qty,
    }).pipe(
      map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
    );
  }

  getAll(): Observable<ApiResponse<StockRequest[]>> {
    return this.http.get<any>(this.requestStoreUrl).pipe(
      map(res => {
        const raw: any[] = Array.isArray(res) ? res : (res.data ?? []);
        return { success: true, data: raw.map(r => this.mapItem(r)) };
      })
    );
  }

  updateStatus(id: string, status: string, operatorName?: string): Observable<ApiResponse<StockRequest>> {
    return this.http.patch<any>(`${this.requestStoreUrl}/${id}/status`, {
      status,
      operatorName: operatorName ?? null
    }).pipe(
      map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
    );
  }

  updateQty(id: string, qty: number): Observable<ApiResponse<StockRequest>> {
    return this.http.patch<any>(`${this.requestStoreUrl}/${id}`, { qty }).pipe(
      map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
    );
  }

  /** Record a packed batch (partial or final). Backend logs date+qty and flips status automatically. */
  fulfillPart(id: string, qty: number, operatorName?: string): Observable<FulfillResult> {
    return this.http.patch<any>(`${this.requestStoreUrl}/${id}/fulfill`, {
      qty,
      operatorName: operatorName ?? null
    }).pipe(
      map(res => ({
        success: true,
        data: this.mapItem(res.data ?? res),
        isNowComplete: !!res.isNowComplete
      }))
    );
  }

  deleteRequest(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<any>(`${this.requestStoreUrl}/${id}`).pipe(
      map(() => ({ success: true, data: undefined }))
    );
  }

  private mapItem(raw: any): StockRequest {
    return {
      stockRequestId: String(raw._id ?? raw.stock_request_id ?? raw.stockRequestId ?? ''),
      packTypeId: String(raw.pack_type_id ?? raw.packTypeId ?? ''),
      packName: raw.pack_name ?? raw.packName ?? '',
      weightKg: raw.weight_kg ?? raw.weightKg ?? 0,
      qty: raw.qty ?? 0,
      fulfilledQty: raw.fulfilled_qty ?? raw.fulfilledQty ?? 0,
      remainingQty: raw.remaining_qty ?? raw.remainingQty
        ?? Math.max((raw.qty ?? 0) - (raw.fulfilled_qty ?? 0), 0),
      fulfillments: (raw.fulfillments ?? []).map((f: any) => ({
        qty: f.qty,
        date: f.date,
        operatorName: f.operator_name ?? f.operatorName ?? null,
      })),
      requestedAt: raw.requested_at ?? raw.requestedAt ?? new Date().toISOString(),
      status: raw.status ?? 'PENDING',
      operatorName: raw.operator_name ?? raw.operatorName ?? null,
    };
  }
}