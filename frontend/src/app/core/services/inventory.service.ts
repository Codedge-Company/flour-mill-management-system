import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment.prod';
import {
  InventoryItem,
  CreatePackTypeRequest,
  UpdateStockRequest,
  UpdateCostRequest,
  UpdateThresholdRequest
} from '../models/inventory';
import { CostHistory } from '../models/cost-history';
import { ApiResponse } from '../models/api-response';

@Injectable({ providedIn: 'root' })
export class InventoryService {
  private readonly packUrl = `${environment.apiUrl}/pack-types`;
  private readonly inventoryUrl = `${environment.apiUrl}/inventory`;
  private readonly costUrl = `${environment.apiUrl}/costs`;
  private readonly thresholdUrl = `${environment.apiUrl}/thresholds`;

  constructor(private http: HttpClient) { }

  // ── Pack Types ───────────────────────────────────────────────

  createPackType(request: CreatePackTypeRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.post<any>(this.packUrl, {
      pack_name: request.packName,
      weight_kg: request.weightKg,
      initial_stock: request.initialStock,
      initial_cost: request.initialCost,
      threshold_qty: request.thresholdQty
    }).pipe(
      map(res => ({
        success: true,
        data: this.mapItem(res.data ?? res)
      }))
    );
  }

  deletePackType(packTypeId: string): Observable<ApiResponse<void>> {
    return this.http.delete<any>(`${this.packUrl}/${packTypeId}`).pipe(
      map(res => ({ success: true, data: res.data ?? null }))
    );
  }

  // ── Inventory ─────────────────────────────────────────────────
  // GET /inventory  → returns joined list of all pack types with stock/cost/threshold

  getAll(): Observable<ApiResponse<InventoryItem[]>> {
    return this.http.get<any>(this.inventoryUrl).pipe(
      map(res => {
        const raw: any[] = Array.isArray(res)
          ? res
          : Array.isArray(res.data)
            ? res.data
            : [];
        return {
          success: true,
          data: raw.map(item => this.mapItem(item))
        } as ApiResponse<InventoryItem[]>;
      })
    );
  }

  // GET /inventory/:packTypeId  → single joined item
  getById(packTypeId: string): Observable<ApiResponse<InventoryItem>> {
    return this.http.get<any>(`${this.inventoryUrl}/${packTypeId}`).pipe(
      map(res => {
        const raw = Array.isArray(res) ? res[0] : (res.data ?? res);
        return { success: true, data: this.mapItem(raw) };
      })
    );
  }

  // PUT /inventory/:packTypeId  → add stock
  addStock(request: UpdateStockRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.put<any>(
      `${this.inventoryUrl}/${request.packTypeId}`,
      { add_qty: request.addQty }          // snake_case to match backend
    ).pipe(
      map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
    );
  }

  // ── Costs ─────────────────────────────────────────────────────
  // POST /costs  → update current cost
  updateCost(request: UpdateCostRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.post<any>(this.costUrl, {
      pack_type_id: request.packTypeId,
      unit_cost: request.unitCost,
      effective_from: request.effectiveFrom,
    }).pipe(
      map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
    );
  }

  // GET /costs/pack/:packTypeId  → cost history for one pack
  getCostHistory(packTypeId: string): Observable<ApiResponse<CostHistory[]>> {
    return this.http.get<any>(`${this.costUrl}/pack/${packTypeId}`).pipe(
      map(res => {
        const raw: any[] = Array.isArray(res)
          ? res
          : Array.isArray(res.data)
            ? res.data
            : [];
        return {
          success: true,
          data: raw.map(h => this.mapCostHistory(h))
        };
      })
    );
  }

  // ── Thresholds ────────────────────────────────────────────────
  // PUT /thresholds/:packTypeId  → update low-stock threshold
  updateThreshold(request: UpdateThresholdRequest): Observable<ApiResponse<InventoryItem>> {
    return this.http.put<any>(
      `${this.thresholdUrl}/${request.packTypeId}`,
      { threshold_qty: request.thresholdQty }
    ).pipe(
      map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
    );
  }

  // ── Mappers ───────────────────────────────────────────────────

private mapItem = (raw: any): InventoryItem => ({
  packTypeId:    String(raw.pack_type_id ?? raw._id         ?? raw.packTypeId   ?? ''),
  packName:      raw.pack_name           ?? raw.packName     ?? '',
  weightKg:      raw.weight_kg           ?? raw.weightKg     ?? 0,
  stockQty:      raw.stock_qty           ?? raw.stockQty     ?? 0,
  lastUpdatedAt: raw.last_updated_at     ?? raw.lastUpdatedAt ?? new Date().toISOString(),
  currentCost:   raw.unit_cost           ?? raw.currentCost  ?? 0,
  costUpdatedAt: raw.cost_updated_at     ?? raw.costUpdatedAt ?? new Date().toISOString(),
  threshold:     raw.threshold_qty       ?? raw.threshold    ?? 0,
  isLowStock:    raw.is_low_stock        ?? raw.isLowStock
                 ?? ((raw.stock_qty      ?? raw.stockQty     ?? 0) <=
                     (raw.threshold_qty  ?? raw.threshold    ?? 0))
});


  private mapCostHistory = (h: any): CostHistory => {
    const pt = (h.pack_type_id && typeof h.pack_type_id === 'object')
      ? h.pack_type_id
      : null;

    return {
      costHistoryId: String(h._id ?? h.cost_history_id ?? h.costHistoryId ?? ''),
      packTypeId: String(pt?._id ?? h.pack_type_id ?? h.packTypeId ?? ''),
      packName: pt?.pack_name ?? h.pack_name ?? h.packName ?? '',
      unitCost: h.unit_cost ?? h.unitCost ?? 0,
      effectiveFrom: h.effective_from ?? h.effectiveFrom ?? '',
      updatedByUserName: h.updated_by_user_name ?? h.updatedByUserName ?? null
    };
  };
 updatePackName(packTypeId: string, packName: string): Observable<ApiResponse<InventoryItem>> {
  return this.http.patch<any>(`${this.packUrl}/${packTypeId}`, { pack_name: packName }).pipe(
    map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
  );
}
setStock(packTypeId: string, setQty: number): Observable<ApiResponse<InventoryItem>> {
  return this.http.patch<any>(
    `${this.inventoryUrl}/${packTypeId}`,
    { set_qty: setQty }
  ).pipe(
    map(res => ({ success: true, data: this.mapItem(res.data ?? res) }))
  );
}
}
