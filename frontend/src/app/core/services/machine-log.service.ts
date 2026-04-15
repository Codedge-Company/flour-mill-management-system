// machine-log.service.ts  — ADD the getAllLogs() method below to your existing service
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../../environments/environment.prod';

export interface MachineSession {
  sessionNumber: number;
  startTime: string | null;
  stopTime: string | null;
  startNotified: boolean;
  stopNotified: boolean;
}

export interface MachineLog {
  _id: string;
  date: string;
  // The backend populates with `username`; the field is typed as `name` here for legacy compat.
  // The dashboard handles both via: (log.operator as any)?.username || (log.operator as any)?.name
  operator: { _id: string; name: string; username?: string };
  partner:  { _id: string; name: string; username?: string };
  sessions: MachineSession[];
  hasStockEntry: boolean;
  rawRiceReceived: number | null;
  input: number | null;
  output: number | null;
  rejection: number | null;
  rejectionDate: string | null;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class MachineLogService {
  private readonly base = `${environment.apiUrl}/machine-logs`;

  constructor(private http: HttpClient) {}

  getByDate(date: Date): Observable<MachineLog | null> {
    const params = new HttpParams().set('date', this.toDateString(date));
    return this.http
      .get<{ success: boolean; data: MachineLog | null }>(`${this.base}/by-date`, { params })
      .pipe(map(r => r.data));
  }

  createLog(date: Date, operatorId: string, partnerId: string): Observable<MachineLog> {
    return this.http
      .post<{ success: boolean; data: MachineLog }>(this.base, {
        date: this.toDateString(date),
        operatorId,
        partnerId,
      })
      .pipe(map(r => r.data));
  }

  updateOperators(logId: string, operatorId: string, partnerId: string): Observable<MachineLog> {
    return this.http
      .patch<{ success: boolean; data: MachineLog }>(`${this.base}/${logId}/operators`, {
        operatorId,
        partnerId,
      })
      .pipe(map(r => r.data));
  }

  recordStart(logId: string, sessionNumber: number): Observable<MachineLog> {
    return this.http
      .post<{ success: boolean; data: MachineLog }>(
        `${this.base}/${logId}/sessions/${sessionNumber}/start`, {}
      )
      .pipe(map(r => r.data));
  }

  recordStop(logId: string, sessionNumber: number): Observable<MachineLog> {
    return this.http
      .post<{ success: boolean; data: MachineLog }>(
        `${this.base}/${logId}/sessions/${sessionNumber}/stop`, {}
      )
      .pipe(map(r => r.data));
  }

  updateStock(
    logId: string,
    stock: {
      rawRiceReceived: number | null;
      input: number | null;
      output: number | null;
      rejection: number | null;
      rejectionDate: string | null;
    }
  ): Observable<MachineLog> {
    return this.http
      .patch<{ success: boolean; data: MachineLog }>(`${this.base}/${logId}/stock`, stock)
      .pipe(map(r => r.data));
  }

  // ── NEW: Fetch paginated / date-filtered logs for the dashboard ───────────
  getAllLogs(params: {
    page?:  number;
    limit?: number;
    from?:  string | null;
    to?:    string | null;
  } = {}): Observable<{ logs: MachineLog[]; total: number; page: number; limit: number }> {
    let httpParams = new HttpParams();
    if (params.page  != null) httpParams = httpParams.set('page',  String(params.page));
    if (params.limit != null) httpParams = httpParams.set('limit', String(params.limit));
    if (params.from)          httpParams = httpParams.set('from',  params.from);
    if (params.to)            httpParams = httpParams.set('to',    params.to);

    // Backend responds: { success: true, logs: [...], total: N, page: N, limit: N }
    return this.http
      .get<{ success: boolean; logs: MachineLog[]; total: number; page: number; limit: number }>(
        this.base, { params: httpParams }
      )
      .pipe(map(r => ({ logs: r.logs ?? [], total: r.total, page: r.page, limit: r.limit })));
  }

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}