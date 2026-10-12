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
  /** empty (unfilled) bags in the store room */
  emptyBagQty:       number;
  /** 0 = no low-stock alert for empty bags */
  emptyBagThreshold: number;
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
  effectiveFrom: string;
}

export interface UpdateThresholdRequest {
  packTypeId:   string;
  thresholdQty: number;
}
