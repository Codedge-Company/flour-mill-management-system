// src/app/core/models/dashboard.ts
export interface DashboardData {
  summary: {
    totalRevenue: number;
    totalCost: number;
    totalProfit: number;
    totalSales: number;
  };
  dailyMetrics: DailyMetric[];
  customerPerformance: CustomerPerformance[];
}

export interface DateRange {
  dateFrom: string;
  dateTo: string;
}

// ✅ EXPORT THESE
export interface DailyMetric {
  date: string;
  revenue: number;
  cost: number;
  profit: number;
}

// src/app/core/models/dashboard.ts
export interface CustomerPerformance {
  customerName: string;
  revenue: number;      // ✅ Matches backend
  salesCount: number;   // ✅ Matches backend (not totalSales)
  // Add optional customerId for tracking
  customerId?: string;
}

export interface DashboardSummary {
  today: {
    revenue: number;
    profit: number;
    salesCount: number;
  };
  month: {
    revenue: number;
    profit: number;
    salesCount: number;
  };
}
