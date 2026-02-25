export interface InventoryItem {
  packTypeId:    string;
  packName:      string;
  weightKg:      number;
  stockQty:      number;
  lastUpdatedAt: string;
  currentCost:   number;
  costUpdatedAt: string;
  threshold:     number;
  isLowStock:    boolean;
}

export interface PackType {
  packTypeId: string;
  packName:   string;
  weightKg:   number;
  isActive:   boolean;
}

export interface CreatePackTypeRequest {
  packName:      string;
  weightKg:      number;
  initialStock:  number;
  initialCost:   number;
  thresholdQty:  number;
}

export interface UpdateStockRequest {
  packTypeId: string;
  addQty:     number;
}

export interface UpdateCostRequest {
  packTypeId: string;
  unitCost:   number;
}

export interface UpdateThresholdRequest {
  packTypeId:   string;
  thresholdQty: number;
}