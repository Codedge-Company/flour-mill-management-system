import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import { SparePart } from '../models/spare-part';

@Injectable({ providedIn: 'root' })
export class SparePartService {
  private readonly base = `${environment.apiUrl}/spare-parts`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<{ success: boolean; data: SparePart[] }> {
    return this.http.get<{ success: boolean; data: SparePart[] }>(this.base);
  }

  create(payload: {
    name: string;
    category: string;
    unit: string;
    qty: number;
    threshold_qty: number;
    supplier_notes: string;
  }): Observable<{ success: boolean; data: SparePart }> {
    return this.http.post<{ success: boolean; data: SparePart }>(this.base, payload);
  }

  addQty(id: string, add_qty: number): Observable<{ success: boolean; data: SparePart }> {
    return this.http.patch<{ success: boolean; data: SparePart }>(`${this.base}/${id}/qty`, { add_qty });
  }

  setQty(id: string, set_qty: number): Observable<{ success: boolean; data: SparePart }> {
    return this.http.patch<{ success: boolean; data: SparePart }>(`${this.base}/${id}/qty`, { set_qty });
  }

  updateDetails(
    id: string,
    payload: Partial<{ name: string; category: string; unit: string; threshold_qty: number; supplier_notes: string }>
  ): Observable<{ success: boolean; data: SparePart }> {
    return this.http.patch<{ success: boolean; data: SparePart }>(`${this.base}/${id}`, payload);
  }

  remove(id: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.base}/${id}`);
  }
}
