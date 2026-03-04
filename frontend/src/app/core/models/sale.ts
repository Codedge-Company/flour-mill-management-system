// src/app/core/models/sale.ts

export type PaymentMethod  = 'CASH' | 'CARD' | 'BANK' | 'CREDIT';   // ← CREDIT added
export type SaleStatus     = 'SAVED' | 'CANCELLED';
export type PaymentStatus  = 'PENDING' | 'PAID';                      // ← NEW

export interface SaleItem {
  saleItemId?:     string;
  packTypeId:      string;
  packName:        string;
  qty:             number;
  unitPriceSold:   number;
  unitCostAtSale:  number;
  lineRevenue:     number;
  lineCost:        number;
  weightKg:        number | null;
  lineProfit:      number;
}

export interface Sale {
  saleId:              string;
  saleNo:              string;
  customerId:          string;
  customerName:        string;
  customerCode:        string;
  createdByUserName:   string;
  saleDatetime:        string;
  paymentMethod:       PaymentMethod;
  paymentStatus:       PaymentStatus;    // ← NEW  ('PAID' for all legacy records)
  status:              SaleStatus;
  totalRevenue:        number;
  totalCost:           number;
  totalProfit:         number;
  items:               SaleItem[];
}

export interface CreateSaleRequest {
  customerId:     string;
  paymentMethod:  PaymentMethod;
  items:          CreateSaleItemRequest[];
}

export interface CreateSaleItemRequest {
  packTypeId:     string;
  qty:            number;
  unitPriceSold:  number;
}

// UI-only row used in new-sale / edit-sale form
export interface SaleItemRow {
  id?:             number;
  packTypeId:      string | null;
  packName:        string;
  qty:             number;
  unitPriceSold:   number;
  unitCostAtSale:  number;
  availableStock:  number;
  lineRevenue:     number;
  lineCost:        number;
  lineProfit:      number;
}

export interface SaleFilters {
  customerId?:    string;
  status?:        SaleStatus;
  paymentMethod?: PaymentMethod;    // ← NEW filter
  paymentStatus?: PaymentStatus;    // ← NEW filter
  dateFrom?:      string;
  dateTo?:        string;
}