export interface CustomerPriceRule {
  priceRuleId: string;
  customerId: string;
  packTypeId: string;
  packName: string;
  unitSellPrice: number;
  effectiveFrom: string;
  isActive: boolean;
}

export interface UpsertPriceRuleRequest {
  customerId: string;
  packTypeId: string;
  unitSellPrice: number;
}