// src/app/core/services/inventory.service.ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  InventoryItem,
  UpdateStockRequest,
  UpdateCostRequest,
  UpdateThresholdRequest
} from '../models/inventory';
import { CostHistory } from '../models/cost-history';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly apiUrl = `${environment.apiUrl}/inventory`;

  constructor(private http: HttpClient) {}

  getAll(): Observable<ApiResponse<InventoryItem[]>> {
    return this.http.get<ApiResponse<InventoryItem[]>>(this.apiUrl);
  }

  getById(packTypeId: number): Observable<ApiResponse<InventoryItem>> {
    return this.http.get<ApiResponse<InventoryItem>>(`${this.apiUrl}/${packTypeId}`);
  }

  addStock(request: UpdateStockRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.post<ApiResponse<InventoryItem>>(
      `${this.apiUrl}/${request.packTypeId}/add-stock`,
      { addQty: request.addQty }
    );
  }

  updateCost(request: UpdateCostRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.post<ApiResponse<InventoryItem>>(
      `${this.apiUrl}/${request.packTypeId}/update-cost`,
      { unitCost: request.unitCost }
    );
  }

  updateThreshold(request: UpdateThresholdRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.put<ApiResponse<InventoryItem>>(
      `${this.apiUrl}/${request.packTypeId}/threshold`,
      { thresholdQty: request.thresholdQty }
    );
  }

  getCostHistory(packTypeId: number): Observable<ApiResponse<CostHistory[]>> {
    return this.http.get<ApiResponse<CostHistory[]>>(
      `${this.apiUrl}/${packTypeId}/cost-history`
    );
  }
}