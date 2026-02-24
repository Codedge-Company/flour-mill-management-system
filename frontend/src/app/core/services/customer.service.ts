// src/app/core/services/customer.service.ts
import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
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

  constructor(private http: HttpClient) {}

  getAll(search?: string): Observable<ApiResponse<Customer[]>> {
    let params = new HttpParams();
    if (search) params = params.set('search', search);
    return this.http.get<ApiResponse<Customer[]>>(this.apiUrl, { params });
  }

  getById(id: number): Observable<ApiResponse<Customer>> {
    return this.http.get<ApiResponse<Customer>>(`${this.apiUrl}/${id}`);
  }

  create(request: CreateCustomerRequest): Observable<ApiResponse<Customer>> {
    return this.http.post<ApiResponse<Customer>>(this.apiUrl, request);
  }

  update(id: number, request: UpdateCustomerRequest): Observable<ApiResponse<Customer>> {
    return this.http.put<ApiResponse<Customer>>(`${this.apiUrl}/${id}`, request);
  }

  delete(id: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.apiUrl}/${id}`);
  }

  // Price Rules
  getPriceRules(customerId: number): Observable<ApiResponse<CustomerPriceRule[]>> {
    return this.http.get<ApiResponse<CustomerPriceRule[]>>(
      `${this.apiUrl}/${customerId}/price-rules`
    );
  }

  upsertPriceRule(request: UpsertPriceRuleRequest): Observable<ApiResponse<CustomerPriceRule>> {
    return this.http.post<ApiResponse<CustomerPriceRule>>(
      `${this.apiUrl}/${request.customerId}/price-rules`,
      request
    );
  }

  deletePriceRule(customerId: number, ruleId: number): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(
      `${this.apiUrl}/${customerId}/price-rules/${ruleId}`
    );
  }

  // Used in new-sale: get effective price for a customer + pack combo
  getEffectivePrice(customerId: number, packTypeId: number): Observable<ApiResponse<{ unitSellPrice: number }>> {
    return this.http.get<ApiResponse<{ unitSellPrice: number }>>(
      `${this.apiUrl}/${customerId}/effective-price/${packTypeId}`
    );
  }
}