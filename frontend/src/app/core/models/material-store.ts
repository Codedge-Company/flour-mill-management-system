export interface RawRiceEntry {
  date: string;
  rawRiceReceived: number | null;
  input: number | null;
}

export interface RawRiceStockSummary {
  totalReceived: number;
  totalInput: number;
  currentBalance: number;
  recentEntries: RawRiceEntry[];
}
