// src/app/core/models/payment.model.ts

export interface Payment {
  paymentId:   string;
  paymentNo:   string;
  saleId:      string;
  saleNo:      string;
  customerId:  string;
  amount:      number;
  paymentDate: string;
  notes:       string;
  recordedBy:  string;
  createdAt:   string;
}

export interface SaleCreditItem {
  saleItemId:     string;
  packTypeId:     string;
  packName:       string;
  weightKg:       number | null;
  qty:            number;
  unitPriceSold:  number;
  unitCostAtSale: number;
  lineRevenue:    number;
  lineCost:       number;
  lineProfit:     number;
}

export interface SaleCreditSummary {
  sale: {
    saleId:          string;
    saleNo:          string;
    saleDatetime:    string;
    totalRevenue:    number;
    totalCost:       number;
    totalProfit:     number;
    paymentStatus:   'PENDING' | 'PAID';
    items:           SaleCreditItem[];
    customerName:    string;
    customerCode:    string;
    customerAddress: string;
    customerPhone:   string;
  };
  payments:   Payment[];
  totalPaid:  number;
  balanceDue: number;
  isPaid:     boolean;
}

export interface AddPaymentRequest {
  saleId:      string;
  amount:      number;
  paymentDate: string;   // YYYY-MM-DD
  notes?:      string;
}