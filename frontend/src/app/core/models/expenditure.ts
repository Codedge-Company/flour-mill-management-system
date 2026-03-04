// core/models/expenditure.ts

export interface Expenditure {
  _id:         string;
  description: string;
  amount:      number;
  date:        string;   // ISO string
  createdAt?:  string;
  updatedAt?:  string;
}

export interface CreateExpenditureDto {
  description: string;
  amount:      number;
  date:        string;
}

export interface UpdateExpenditureDto {
  description?: string;
  amount?:      number;
  date?:        string;
}