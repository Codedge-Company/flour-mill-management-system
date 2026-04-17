import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment.prod';

export interface BatchOption {
  _id: string;
  batchNo: string;
  date: string;
  rawRiceReceived: number;
  input: number;
  output: number;
  operatorName: string;
  partnerName: string;
  remainingStock: number;
  totalSievedInput: number;
}

export interface SievingPart {
  _id: string;
  partNo: number;
  input: number | null;
  output: number | null;
  rejection: number | null;
  note: string;
  createdAt: string;
}

export interface SievingLog {
  _id: string;
  machineLogId: string;
  batchNo: string;
  operator: { _id: string; username: string };  
  date: string;
  parts: SievingPart[];                         
  totalInput: number;
  totalOutput: number;
  totalRejection: number;
  isCompleted: boolean;
  completedAt: string | null;
  completionNotified: boolean;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class SievingLogService {
  private readonly base = `${environment.apiUrl}/sieving-logs`;
  constructor(private http: HttpClient) {}

  getAvailableBatches(): Observable<BatchOption[]> {
    return this.http.get<{ success: boolean; data: BatchOption[] }>(`${this.base}/batches`)
      .pipe(map(r => r.data));
  }

  /** Fetch the current operator's active (incomplete) log — returns null if none */
  getActiveLog(): Observable<SievingLog | null> {
    return this.http.get<{ success: boolean; data: SievingLog }>(`${this.base}/active`)
      .pipe(
        map(r => r.data ?? null),
        catchError(() => of(null))   // no active log = not an error
      );
  }

  createLog(machineLogId: string, operatorId: string, date?: Date): Observable<SievingLog> {
    return this.http.post<{ success: boolean; data: SievingLog }>(this.base, {
      machineLogId, operatorId,
      date: date ? date.toISOString().split('T')[0] : undefined,
    }).pipe(map(r => r.data));
  }

  addPart(id: string, part: { input: number | null; output: number | null; rejection: number | null; note?: string }): Observable<SievingLog> {
    return this.http.post<{ success: boolean; data: SievingLog }>(`${this.base}/${id}/parts`, part)
      .pipe(map(r => r.data));
  }

  updatePart(id: string, partId: string, part: Partial<SievingPart>): Observable<SievingLog> {
    return this.http.patch<{ success: boolean; data: SievingLog }>(`${this.base}/${id}/parts/${partId}`, part)
      .pipe(map(r => r.data));
  }

  removePart(id: string, partId: string): Observable<SievingLog> {
    return this.http.delete<{ success: boolean; data: SievingLog }>(`${this.base}/${id}/parts/${partId}`)
      .pipe(map(r => r.data));
  }

  completeLog(id: string): Observable<SievingLog> {
    return this.http.post<{ success: boolean; data: SievingLog }>(`${this.base}/${id}/complete`, {})
      .pipe(map(r => r.data));
  }
}