export type PaymentMethod = 'CASH' | 'CARD' | 'BANK';
export type SaleStatus = 'SAVED' | 'CANCELLED';

export interface SaleItem {
  saleItemId?: string;
  packTypeId: string;
  packName: string;
  qty: number;
  unitPriceSold: number;
  unitCostAtSale: number;
  lineRevenue: number;
  lineCost: number;
  weightKg: number | null;
  lineProfit: number;
}

export interface Sale {
  saleId: string;
  saleNo: string;
  customerId: string;
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
  customerId: string;
  paymentMethod: PaymentMethod;
  items: CreateSaleItemRequest[];
}

export interface CreateSaleItemRequest {
  packTypeId: string;
  qty: number;
  unitPriceSold: number;
}

// UI-only row used in new-sale form
export interface SaleItemRow {
  id?: number; // Added optional id for unique tracking in @for
  packTypeId: string | null;
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
  customerId?: string;
  status?: SaleStatus;
  dateFrom?: string;
  dateTo?: string;
}