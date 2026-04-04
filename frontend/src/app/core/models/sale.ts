// src/app/core/models/sale.ts

export type PaymentMethod = 'CASH' | 'CARD' | 'BANK' | 'CREDIT';
export type SaleStatus    = 'SAVED' | 'CANCELLED';
export type PaymentStatus = 'PENDING' | 'PAID';

export interface SaleItem {
  saleItemId?:    string;
  packTypeId:     string;
  packName:       string;
  qty:            number;
  unitPriceSold:  number;
  unitCostAtSale: number;
  lineRevenue:    number;
  lineCost:       number;
  weightKg:       number | null;
  lineProfit:     number;
}

export interface Sale {
  saleId:            string;
  saleNo:            string;
  customerId:        string;
  customerName:      string;
  customerCode:      string;
  createdByUserName: string;
  saleDatetime:      string;
  paymentMethod:     PaymentMethod;
  paymentStatus:     PaymentStatus;
  status:            SaleStatus;
  totalRevenue:      number;
  totalCost:         number;
  totalProfit:       number;
  totalPaid:         number | null;   // sum of all Payment records for this sale
  items:             SaleItem[];
}

export interface CreateSaleRequest {
  customerId:    string;
  paymentMethod: PaymentMethod;
  saleDate?:     string;
  items:         CreateSaleItemRequest[];
  useDefaultPrice?: boolean;  
}

export interface CreateSaleItemRequest {
  packTypeId:    string;
  qty:           number;
  unitPriceSold: number;
}

export interface SaleItemRow {
  id?:            number;
  packTypeId:     string | null;
  packName:       string;
  qty:            number;
  unitPriceSold:  number;
  unitCostAtSale: number;
  availableStock: number;
  lineRevenue:    number;
  lineCost:       number;
  lineProfit:     number;
}

export interface SaleFilters {
  customerId?:    string;
  status?:        SaleStatus;
  paymentMethod?: PaymentMethod;
  paymentStatus?: PaymentStatus;
  dateFrom?:      string;
  dateTo?:        string;
}