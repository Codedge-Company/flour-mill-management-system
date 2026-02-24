
export interface CustomerPriceRule {
  priceRuleId: number;
  customerId: number;
  packTypeId: number;
  packName: string;
  unitSellPrice: number;
  effectiveFrom: string;
  isActive: boolean;
}

export interface UpsertPriceRuleRequest {
  customerId: number;
  packTypeId: number;
  unitSellPrice: number;
}