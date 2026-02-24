
export interface DashboardSummary {
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalSales: number;
  dateFrom: string;
  dateTo: string;
}

export interface DailyMetric {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

export interface CustomerPerformance {
  customerId: number;
  customerName: string;
  totalRevenue: number;
  totalProfit: number;
  totalSales: number;
}

export interface DashboardData {
  summary: DashboardSummary;
  dailyMetrics: DailyMetric[];
  customerPerformance: CustomerPerformance[];
}

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}