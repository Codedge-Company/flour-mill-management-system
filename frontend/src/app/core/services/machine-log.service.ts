// machine-log.service.ts
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
  operator: { _id: string; name: string };
  partner: { _id: string; name: string };
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
        `${this.base}/${logId}/sessions/${sessionNumber}/start`,
        {}
      )
      .pipe(map(r => r.data));
  }

  recordStop(logId: string, sessionNumber: number): Observable<MachineLog> {
    return this.http
      .post<{ success: boolean; data: MachineLog }>(
        `${this.base}/${logId}/sessions/${sessionNumber}/stop`,
        {}
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

  private toDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
  
}
