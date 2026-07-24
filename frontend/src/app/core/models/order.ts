export interface OrderItem {
  _id: string;
  pack_type_id: { _id: string; pack_name: string; weight_kg: number } | string;
  qty: number;
  unit_price: number;
  line_total: number;
}

export interface Order {
  _id: string;
  order_no: string;
  customer_id: { _id: string; name: string; customer_code: string } | null;
  created_by: { _id: string; full_name: string; username: string } | null;
  payment_method: 'CASH' | 'CREDIT';
  expected_date: string;
  items: OrderItem[];
  total_amount: number;
  notes: string;
  status: 'PENDING' | 'COMPLETED';
  completed_at: string | null;
  completed_by: { _id: string; full_name: string; username: string } | null;
  createdAt: string;

  // Set once "Done" creates the real Sale + deducts stock.
  sale_id: { _id: string; sale_no: string; payment_status: 'PENDING' | 'PAID' } | string | null;
}

export interface CreateOrderPayload {
  customer_id: string;
  payment_method: 'CASH' | 'CREDIT';
  expected_date: string; // ISO date string
  notes?: string;
  items: {
    pack_type_id: string;
    qty: number;
    unit_price: number;
  }[];
}

export interface OrderStats {
  totalOrders: number;
  pendingOrders: number;
  completedOrders: number;
  overdueOrders: number;
  onTimeCount: number;
  lateCount: number;
  onTimeRate: number;
  avgDelayDays: number;
  avgLeadTimeDays: number;
  weeklyTrend: { weekLabel: string; count: number }[];
}