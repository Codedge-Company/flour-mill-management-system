// src/app/core/models/budget-entry.ts

export interface BudgetEntry {
  _id:         string;
  description: string;
  amount:      number;
  date:        string;   // ISO string
  createdAt?:  string;
}

export interface CreateBudgetEntryDto {
  description: string;
  amount:      number;
  date:        string;
}