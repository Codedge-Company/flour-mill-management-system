// src/app/core/models/cost-history.model.ts
export interface CostHistory {
  costHistoryId: number;
  packTypeId: number;
  packName: string;
  unitCost: number;
  effectiveFrom: string;
  updatedByUserName: string | null;
}