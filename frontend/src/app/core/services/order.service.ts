import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.prod';
import { Order, CreateOrderPayload, OrderStats } from '../models/order';

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly base = `${environment.apiUrl}/orders`;

  constructor(private http: HttpClient) {}

  create(payload: CreateOrderPayload): Observable<Order> {
    return this.http
      .post<{ success: boolean; data: Order }>(this.base, payload)
      .pipe(map(r => r.data));
  }

  /** Employee: orders they created */
  getMyOrders(): Observable<Order[]> {
    return this.http
      .get<{ success: boolean; data: Order[] }>(`${this.base}/my`)
      .pipe(map(r => r.data));
  }

  /** Admin: all orders, optionally filtered by status */
  getAll(status?: 'PENDING' | 'COMPLETED'): Observable<Order[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http
      .get<{ success: boolean; data: Order[] }>(this.base, { params })
      .pipe(map(r => r.data));
  }

  /** Admin: reminder queue — pending orders, soonest due date first */
  getPendingQueue(): Observable<Order[]> {
    return this.http
      .get<{ success: boolean; data: Order[] }>(`${this.base}/queue`)
      .pipe(map(r => r.data));
  }

  /** Admin: efficiency analysis stats */
  getStats(): Observable<OrderStats> {
    return this.http
      .get<{ success: boolean; data: OrderStats }>(`${this.base}/stats`)
      .pipe(map(r => r.data));
  }

  markDone(id: string): Observable<Order> {
    return this.http
      .patch<{ success: boolean; data: Order }>(`${this.base}/${id}/done`, {})
      .pipe(map(r => r.data));
  }
}