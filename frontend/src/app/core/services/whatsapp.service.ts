import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, interval, switchMap, startWith } from 'rxjs';
import { environment } from '../../../environments/environment.prod';

export interface WhatsAppStatus {
  qrImage: string | null;
  ready: boolean;
}

@Injectable({ providedIn: 'root' })
export class WhatsAppService {
  constructor(private http: HttpClient) {}

  pollStatus(): Observable<WhatsAppStatus> {
    return interval(2000).pipe(
      startWith(0),
      switchMap(() => this.http.get<WhatsAppStatus>(`${environment.apiUrl}/whatsapp/qr`))
    );
  }
}