// src/app/core/services/customer.service.ts (updated to match backend endpoints and assumptions)
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, catchError, map, of } from 'rxjs'; // Added map import
import { environment } from '../../../environments/environment';
import {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest
} from '../models/customer';
import {
  CustomerPriceRule,
  UpsertPriceRuleRequest
} from '../models/customer-price-rule';
import { ApiResponse, PagedResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class CustomerService {
  private readonly apiUrl = `${environment.apiUrl}/customers`;
  private readonly priceRuleApi = `${environment.apiUrl}/customer-price-rules`;

  constructor(private http: HttpClient) { }

  getAll(search?: string): Observable<ApiResponse<Customer[]>> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<ApiResponse<any[]>>(this.apiUrl, { params }).pipe( // Temporarily any[] for raw data
      map(res => ({
        ...res,
        data: res.data.map(c => this.mapToCustomer(c))
      }))
    );
  }

  getById(customerId: string): Observable<ApiResponse<Customer>> {
    return this.http.get<any>(`${this.apiUrl}/${customerId}`).pipe(
      map((response) => {
        const raw = response.data || response;
        return {
          success: true,
          data: {
            customerId: raw._id,
            customerCode: raw.customer_code,
            name: raw.name,
            phone: raw.phone ?? null,
            address: raw.address ?? null,
            notes: raw.notes ?? null,
            createdAt: raw.created_at,
            creditLimit: raw.credit_limit ?? null,
          } as Customer
        };
      })
    );
  }

  create(request: CreateCustomerRequest): Observable<ApiResponse<Customer>> {
    return this.http.post<ApiResponse<any>>(this.apiUrl, request).pipe(
      map(res => ({
        ...res,
        data: this.mapToCustomer(res.data)
      }))
    );
  }

  update(id: string, request: UpdateCustomerRequest): Observable<ApiResponse<Customer>> { // Changed to string
    return this.http.put<ApiResponse<any>>(`${this.apiUrl}/${id}`, request).pipe(
      map(res => ({
        ...res,
        data: this.mapToCustomer(res.data)
      }))
    );
  }

  delete(id: string): Observable<ApiResponse<void>> { // Changed to string
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  // Price Rules (updated endpoints to match backend routes)
  getPriceRules(customerId: string): Observable<ApiResponse<CustomerPriceRule[]>> {
    return this.http.get<any[]>(`${this.priceRuleApi}/customer/${customerId}`).pipe(
      map((rawRules) => {
        console.log('Raw rules response:', rawRules); // Debug
        return {
          success: true,
          data: rawRules.map(rule => this.mapToPriceRule(rule))
        } as ApiResponse<CustomerPriceRule[]>;
      })
    );
  }


  upsertPriceRule(request: UpsertPriceRuleRequest): Observable<any> {
    const payload = {
      customer_id: request.customerId,
      pack_type_id: request.packTypeId,
      unit_sell_price: request.unitSellPrice
    };

    return this.http.post<any>(this.priceRuleApi, payload).pipe(
      // Transform raw backend response to expected format
      map((rawResponse) => {
        console.log('Raw backend response:', rawResponse); // Debug
        return {
          success: true,
          data: this.mapToPriceRule(rawResponse)
        };
      }),
      // Catch HTTP errors and transform
      // Note: HttpClient already rejects non-2xx responses
    );
  }



  deletePriceRule(customerId: string, ruleId: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.priceRuleApi}/${ruleId}`);
  }
  // Used in new-sale: get effective price for a customer + pack combo
  getEffectivePrice(customerId: string, packTypeId: string): Observable<{ unitSellPrice: number }> {
    return this.http.get<any>(`${this.apiUrl}/${customerId}/effective-price/${packTypeId}`).pipe(
      map((response) => {
        console.log('Effective price response:', response);
        // Handle ApiResponse wrapper: response.data.unit_sell_price
        const price = response.data?.unit_sell_price ||
          response.unit_sell_price ||
          0;
        console.log('Extracted price:', price);
        return { unitSellPrice: price };
      }),
      catchError(() => of({ unitSellPrice: 0 }))
    );
  }



  private mapToCustomer(raw: any): Customer {
    return {
      customerId: raw._id,
      customerCode: raw.customer_code,
      name: raw.name,
      phone: raw.phone || null,
      address: raw.address || null,
      notes: raw.notes || null,
      createdAt: raw.created_at,
      creditLimit: raw.credit_limit || null // Assuming field exists; adjust if not
    };
  }
  private mapToPriceRule(raw: any): CustomerPriceRule {
    const packTypeIdObj = raw.pack_type_id;
    const packTypeId = typeof packTypeIdObj === 'object' ? packTypeIdObj._id : packTypeIdObj;
    const packName = typeof packTypeIdObj === 'object' ? packTypeIdObj.pack_name : '';

    return {
      priceRuleId: raw._id || raw.priceRuleId || '',
      customerId: raw.customer_id || raw.customerId || '',
      packTypeId: packTypeId || '',
      packName: packName || raw.packName || '',
      unitSellPrice: raw.unit_sell_price || raw.unitSellPrice || 0,
      effectiveFrom: raw.effective_from || raw.effectiveFrom || new Date().toISOString(),
      isActive: raw.is_active !== false
    };
  }


}