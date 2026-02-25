// src/app/core/models/customer.ts (updated with creditLimit)
export interface Customer {
  customerId: string; // Changed to string
  customerCode: string;
  name: string;
  phone: string | null;
  address: string | null;
  notes: string | null;
  createdAt: string;
  creditLimit: number | null; // Added
}

export interface CreateCustomerRequest {
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
}

export interface UpdateCustomerRequest extends CreateCustomerRequest {}