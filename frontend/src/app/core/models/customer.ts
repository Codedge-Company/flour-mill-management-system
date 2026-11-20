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

// Outstanding credit and advance (money paid ahead) of one customer
export interface CustomerBalance {
  customerId:  string;
  outstanding: number;
  advance:     number;
}
