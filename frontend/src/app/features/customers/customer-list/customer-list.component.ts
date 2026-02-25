// src/app/features/customers/customer-list/customer-list.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CustomerService } from '../../../core/services/customer.service';
import { Customer } from '../../../core/models/customer';
import { PageHeaderComponent } from '../../../shared/components/page-header/page-header.component';
import { ConfirmDialogComponent } from '../../../shared/components/confirm-dialog/confirm-dialog.component';
import { TimeAgoPipe } from '../../../shared/pipes/time-ago.pipe';

@Component({
  selector: 'app-customer-list',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FormsModule,
    PageHeaderComponent,
    ConfirmDialogComponent,
    TimeAgoPipe
  ],
  templateUrl: './customer-list.component.html',
  styleUrl: './customer-list.component.css'
})
export class CustomerListComponent implements OnInit {
  customers      = signal<Customer[]>([]);
  loading        = signal(true);
  error          = signal<string | null>(null);
  searchQuery    = signal('');
  deleteTarget   = signal<Customer | null>(null);
  deleteLoading  = signal(false);
  successMessage = signal<string | null>(null);

  private searchTimer: any;

  constructor(private customerService: CustomerService) {}

  ngOnInit(): void { this.load(); }

  load(search?: string): void {
    this.loading.set(true);
    this.error.set(null);

    this.customerService.getAll(search).subscribe({
      
      next: res => {
        this.customers.set(res.data);
        console.log('Loaded customers:', res.data);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Failed to load customers. Please try again.');
        this.loading.set(false);
      }
    });
  }

  onSearch(value: string): void {
    this.searchQuery.set(value);
    clearTimeout(this.searchTimer);
    this.searchTimer = setTimeout(() => this.load(value || undefined), 350);
  }

  confirmDelete(customer: Customer): void {
    this.deleteTarget.set(customer);
  }

  cancelDelete(): void {
    this.deleteTarget.set(null);
  }

  onDelete(): void {
    const target = this.deleteTarget();
    if (!target) return;

    this.deleteLoading.set(true);
    this.customerService.delete(target.customerId).subscribe({
      next: () => {
        this.deleteLoading.set(false);
        this.deleteTarget.set(null);
        this.showSuccess(`Customer "${target.name}" deleted successfully.`);
        this.load(this.searchQuery() || undefined);
      },
      error: err => {
        this.deleteLoading.set(false);
        this.deleteTarget.set(null);
        this.error.set(err?.error?.message ?? 'Failed to delete customer.');
      }
    });
  }

  private showSuccess(msg: string): void {
    this.successMessage.set(msg);
    setTimeout(() => this.successMessage.set(null), 3500);
  }

  getInitials(name: string): string {
    return name.split(' ').map(w => w[0]).join('').substring(0, 2).toUpperCase();
  }
}