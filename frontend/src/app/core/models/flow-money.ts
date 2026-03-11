// src/app/core/models/flow-money.ts

export interface CapitalEntry {
  _id:          string;
  amount:       number;
  label:        string;
  capital_date: string;   // ISO string
  note:         string;
  createdAt:    string;
}

export interface TimelinePoint {
  date:             string;
  dailyRevenue:     number;
  dailyCost:        number;
  dailyProfit:      number;
  dailyCapitalIn:   number;
  netWorth:         number;
  cumulativeCapital: number;
  cumulativeProfit:  number;
  cumulativeRevenue: number;
  cumulativeCost:    number;
}

export interface FlowSummary {
  currentNetWorth:  number;
  totalCapital:     number;
  totalProfit:      number;
  totalRevenue:     number;
  totalCost:        number;
  growthRate:       number;
  avgDailyProfit:   number;
  roi:              number;
  daysTracked:      number;
  bestDay:  { date: string; profit: number } | null;
  worstDay: { date: string; profit: number } | null;
}

export interface FlowMoneyData {
  timeline:    TimelinePoint[];
  summary:     FlowSummary;
  allCapitals: CapitalEntry[];
}

export interface AddCapitalRequest {
  amount:       number;
  label:        string;
  capital_date: string;   // YYYY-MM-DD
  note:         string;
}