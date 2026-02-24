
export type PaymentMethod = 'CASH' | 'CARD' | 'BANK';
export type SaleStatus = 'SAVED' | 'CANCELLED';

export interface SaleItem {
  saleItemId?: number;
  packTypeId: number;
  packName: string;
  qty: number;
  unitPriceSold: number;
  unitCostAtSale: number;
  lineRevenue: number;
  lineCost: number;
  lineProfit: number;
}

export interface Sale {
  saleId: number;
  saleNo: string;
  customerId: number;
  customerName: string;
  customerCode: string;
  createdByUserName: string;
  saleDatetime: string;
  paymentMethod: PaymentMethod;
  status: SaleStatus;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  items: SaleItem[];
}

export interface CreateSaleRequest {
  customerId: number;
  paymentMethod: PaymentMethod;
  items: CreateSaleItemRequest[];
}

export interface CreateSaleItemRequest {
  packTypeId: number;
  qty: number;
  unitPriceSold: number;
}

// UI-only row used in new-sale form
export interface SaleItemRow {
  packTypeId: number | null;
  packName: string;
  qty: number;
  unitPriceSold: number;
  unitCostAtSale: number;
  availableStock: number;
  lineRevenue: number;
  lineCost: number;
  lineProfit: number;
}

export interface SaleFilters {
  customerId?: number;
  status?: SaleStatus;
  dateFrom?: string;
  dateTo?: string;
}