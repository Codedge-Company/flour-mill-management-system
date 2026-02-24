
import { PackType } from './pack-type';

export interface InventoryItem {
  packTypeId: number;
  packName: string;
  weightKg: number;
  stockQty: number;
  lastUpdatedAt: string;
  currentCost: number;
  costUpdatedAt: string;
  threshold: number;
  isLowStock: boolean;
}

export interface UpdateStockRequest {
  packTypeId: number;
  addQty: number;
}

export interface UpdateCostRequest {
  packTypeId: number;
  unitCost: number;
}

export interface UpdateThresholdRequest {
  packTypeId: number;
  thresholdQty: number;
}