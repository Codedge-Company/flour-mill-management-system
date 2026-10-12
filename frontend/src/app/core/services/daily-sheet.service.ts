// core/services/daily-sheet.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.prod';
import { DailySheet, EmptyBagUpdate, SaveSheetRequest } from '../models/daily-sheet';

@Injectable({ providedIn: 'root' })
export class DailySheetService {
  private readonly base = `${environment.apiUrl}/daily-sheet`;

  constructor(private http: HttpClient) { }

  /** date = 'YYYY-MM-DD' (the local Sri Lanka date) */
  get(date: string): Observable<DailySheet> {
    return this.http
      .get<{ success: boolean; data: DailySheet }>(`${this.base}/${date}`)
      .pipe(map(r => r.data));
  }

  save(date: string, body: SaveSheetRequest): Observable<DailySheet> {
    return this.http
      .put<{ success: boolean; data: DailySheet }>(`${this.base}/${date}`, body)
      .pipe(map(r => r.data));
  }

  sendSummary(date: string): Observable<{ endStockSentAt: string }> {
    return this.http
      .post<{ success: boolean; data: { endStockSentAt: string } }>(`${this.base}/${date}/send-summary`, {})
      .pipe(map(r => r.data));
  }

  /** admin / manager: opening balance or correction of the empty-bag count */
  setEmptyBags(packTypeId: string, payload: { setQty?: number; thresholdQty?: number }): Observable<EmptyBagUpdate> {
    const body: Record<string, number> = {};
    if (payload.setQty !== undefined) body['set_qty'] = payload.setQty;
    if (payload.thresholdQty !== undefined) body['threshold_qty'] = payload.thresholdQty;
    return this.http
      .put<{ success: boolean; data: EmptyBagUpdate }>(`${this.base}/empty-bags/${packTypeId}`, body)
      .pipe(map(r => r.data));
  }
}
