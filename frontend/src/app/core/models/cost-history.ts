// src/app/core/models/cost-history.model.ts
export interface CostHistory {
  costHistoryId: string;
  packTypeId: string;
  packName: string;
  unitCost: number;
  effectiveFrom: string;
  updatedByUserName: string | null;
}