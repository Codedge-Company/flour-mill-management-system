// core/models/daily-sheet.ts

export interface PackTypeStock {
  packTypeId: string;
  packName: string;
  weightKg: number;
  /** packed rice in stock (Inventory) */
  riceStock: number;
  /** empty bags in stock */
  emptyBagStock: number;
  emptyBagThreshold: number;
}

export interface GrindBatch {
  batchNo: string;
  operatorId: string | null;
  partnerId: string | null;
  input: number | null;
  output: number | null;
}

export interface SiftEntry {
  batchNo: string;
  input: number | null;
  output: number | null;
  rejection: number | null;
  note: string;
}

export interface QtyLine {
  packTypeId: string;
  qty: number | null;
}

export interface DailySheet {
  date: string;
  exists: boolean;
  machineLogId: string | null;
  rawRiceReceived: number | null;
  defaultOperatorId: string | null;
  defaultPartnerId: string | null;
  batches: GrindBatch[];
  sifting: SiftEntry[];
  packing: QtyLine[];
  emptyBagsReceived: QtyLine[];
  endOfDayStock: QtyLine[];
  endStockSavedAt: string | null;
  endStockSentAt: string | null;
  packTypes: PackTypeStock[];
  /** only present on the response of a save */
  warnings?: string[];
}

export interface SaveSheetRequest {
  rawRiceReceived: number | null;
  batches: GrindBatch[];
  sifting: SiftEntry[];
  packing: QtyLine[];
  emptyBagsReceived: QtyLine[];
  endOfDayStock: QtyLine[];
}

export interface EmptyBagUpdate {
  packTypeId: string;
  emptyBagQty: number;
  emptyBagThreshold: number;
}
