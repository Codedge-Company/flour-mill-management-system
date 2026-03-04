import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Payment, SaleCreditSummary, AddPaymentRequest } from '../models/payment.model';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  private readonly base = environment.apiUrl + '/payments';
  constructor(private http: HttpClient) {}

  addPayment(req: AddPaymentRequest): Observable<ApiResponse<Payment>> {
    return this.http.post<any>(this.base, {
      sale_id: req.saleId, amount: req.amount,
      payment_date: req.paymentDate, notes: req.notes ?? ''
    }).pipe(map(res => ({ success: true, data: this.mapPayment(res.data ?? res) })));
  }

  getBySale(saleId: string): Observable<ApiResponse<Payment[]>> {
    return this.http.get<any>(this.base + '/sale/' + saleId).pipe(
      map(res => ({ success: true, data: (res.data ?? []).map((p: any) => this.mapPayment(p)) }))
    );
  }

  getCreditSummary(customerId: string): Observable<ApiResponse<SaleCreditSummary[]>> {
    return this.http.get<any>(this.base + '/customer/' + customerId + '/credit-summary').pipe(
      map(res => ({ success: true, data: (res.data ?? []).map((r: any) => this.mapSummary(r)) }))
    );
  }

  deletePayment(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(this.base + '/' + id);
  }

  private mapPayment(raw: any): Payment {
    return {
      paymentId: raw._id, paymentNo: raw.payment_no,
      saleId: raw.sale_id?._id ?? raw.sale_id ?? '',
      saleNo: raw.sale_id?.sale_no ?? '',
      customerId: raw.customer_id?._id ?? raw.customer_id ?? '',
      amount: raw.amount, paymentDate: raw.payment_date,
      notes: raw.notes ?? '',
      recordedBy: raw.recorded_by?.full_name ?? raw.recorded_by?.username ?? '',
      createdAt: raw.created_at,
    };
  }

  private mapSummary(raw: any): SaleCreditSummary {
    const s = raw.sale; const cust = s.customer_id ?? {};
    return {
      sale: {
        saleId: s._id, saleNo: s.sale_no, saleDatetime: s.sale_datetime,
        totalRevenue: s.total_revenue, totalCost: s.total_cost, totalProfit: s.total_profit,
        paymentStatus: s.payment_status ?? 'PENDING',
        customerName: cust.name ?? '', customerCode: cust.customer_code ?? '',
        customerAddress: cust.address ?? '', customerPhone: cust.phone ?? '',
        items: (s.items ?? []).map((item: any) => ({
          saleItemId: item._id,
          packTypeId: item.pack_type_id?._id ?? item.pack_type_id ?? '',
          packName: item.pack_type_id?.pack_name ?? '',
          weightKg: item.pack_type_id?.weight_kg ?? null,
          qty: item.qty, unitPriceSold: item.unit_price_sold,
          unitCostAtSale: item.unit_cost_at_sale,
          lineRevenue: item.line_revenue, lineCost: item.line_cost, lineProfit: item.line_profit,
        })),
      },
      payments: (raw.payments ?? []).map((p: any) => ({
        paymentId: p._id, paymentNo: p.payment_no,
        saleId: s._id, saleNo: s.sale_no, customerId: cust._id ?? '',
        amount: p.amount, paymentDate: p.payment_date,
        notes: p.notes ?? '', recordedBy: p.recorded_by?.full_name ?? '',
        createdAt: p.created_at,
      })),
      totalPaid: raw.totalPaid, balanceDue: raw.balanceDue, isPaid: raw.isPaid,
    };
  }
}