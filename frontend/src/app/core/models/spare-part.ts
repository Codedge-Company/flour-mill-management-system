export interface SparePart {
  sparePartId: string;
  name: string;
  category: string;
  unit: string;
  qty: number;
  thresholdQty: number;
  supplierNotes: string;
  isLowStock: boolean;
  lastUpdatedAt: string;
}
