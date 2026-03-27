// sale-request.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.prod';

export interface SaleRequestItem {
  _id:             string;
  pack_type_id:    { _id: string; pack_name: string; weight_kg: number } | string;
  qty:             number;
  unit_price_sold: number;
  line_revenue:    number;
}

export interface SaleRequest {
  _id:              string;
  request_no:       string;
  requested_by:     { _id: string; full_name: string; username: string } | null;   
  sales_person_id:  { _id: string; full_name: string; username: string } | null;   
  customer_id:      { _id: string; name: string; customer_code: string } | null;   
  payment_method:   'CASH' | 'CREDIT';
  request_datetime: string;
  items:            SaleRequestItem[];
  total_preview:    number;
  status:           'PENDING' | 'APPROVED' | 'REJECTED' | 'SAVED';
  reviewed_by:      { _id: string; full_name: string } | null;  
  reviewed_at:      string | null;
  review_note:      string | null;
  sale_id:          string | null;
  createdAt:        string;
}

export interface CreateSaleRequestPayload {
  customer_id:     string;
  payment_method:  'CASH' | 'CREDIT';
  sales_person_id: string;
  items: {
    pack_type_id:    string;
    qty:             number;
    unit_price_sold: number;
  }[];
}

@Injectable({ providedIn: 'root' })
export class SaleRequestService {
  private readonly base = `${environment.apiUrl}/sale-requests`;

  constructor(private http: HttpClient) {}

  /** Submit a new sale request */
  create(payload: CreateSaleRequestPayload): Observable<SaleRequest> {
    return this.http
      .post<{ success: boolean; data: SaleRequest }>(this.base, payload)
      .pipe(map(r => r.data));
  }

  /** Operator: get own requests */
  getMyRequests(): Observable<SaleRequest[]> {
    return this.http
      .get<{ success: boolean; data: SaleRequest[] }>(`${this.base}/my`)
      .pipe(map(r => r.data));
  }

  /** Admin: get all pending requests */
  getPendingRequests(): Observable<SaleRequest[]> {
    return this.http
      .get<{ success: boolean; data: SaleRequest[] }>(`${this.base}/pending`)
      .pipe(map(r => r.data));
  }

  /** Admin: get all requests with optional status filter */
  getAllRequests(page = 0, size = 20, status?: string): Observable<any> {
    let params = new HttpParams().set('page', page).set('size', size);
    if (status) params = params.set('status', status);
    return this.http.get<any>(this.base, { params });
  }

  /** Admin: approve */
  approve(requestId: string): Observable<SaleRequest> {
    return this.http
      .patch<{ success: boolean; data: SaleRequest }>(`${this.base}/${requestId}/approve`, {})
      .pipe(map(r => r.data));
  }

  /** Admin: reject with optional note */
  reject(requestId: string, note = ''): Observable<SaleRequest> {
    return this.http
      .patch<{ success: boolean; data: SaleRequest }>(`${this.base}/${requestId}/reject`, { note })
      .pipe(map(r => r.data));
  }

  /** Operator: save an APPROVED request → creates actual Sale */
  saveSale(requestId: string): Observable<any> {
    return this.http
      .post<{ success: boolean; data: any }>(`${this.base}/${requestId}/save`, {})
      .pipe(map(r => r.data));
  }
}
