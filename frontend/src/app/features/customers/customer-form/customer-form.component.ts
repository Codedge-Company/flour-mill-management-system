// src/app/features/customers/customer-form/customer-form.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CustomerService } from '../../../core/services/customer.service';
import { PageHeaderComponent, Breadcrumb } from '../../../shared/components/page-header/page-header.component';

@Component({
  selector: 'app-customer-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, PageHeaderComponent],
  templateUrl: './customer-form.component.html',
  styleUrl: './customer-form.component.css'
})
export class CustomerFormComponent implements OnInit {
  form: FormGroup;
  loading    = signal(false);
  fetchLoad  = signal(false);
  error      = signal<string | null>(null);
  customerId = signal<string | null>(null);

  get isEdit(): boolean { return !!this.customerId(); }

  get breadcrumbs(): Breadcrumb[] {
    return [
      { label: 'Customers', route: '/customers' },
      { label: this.isEdit ? 'Edit Customer' : 'New Customer' }
    ];
  }

  get f() { return this.form.controls; }

  constructor(
    private fb: FormBuilder,
    private customerService: CustomerService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      name:    ['', [Validators.required, Validators.minLength(2), Validators.maxLength(150)]],
      phone:   ['', [Validators.maxLength(30)]],
      address: ['', [Validators.maxLength(255)]],
      notes:   ['', [Validators.maxLength(255)]]
    });
  }

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.customerId.set(id);
      this.loadCustomer(id);
    }
  }

  private loadCustomer(id: string): void {
    this.fetchLoad.set(true);
    this.customerService.getById(id).subscribe({
      next: res => {
        this.form.patchValue({
          name:    res.data.name,
          phone:   res.data.phone   ?? '',
          address: res.data.address ?? '',
          notes:   res.data.notes   ?? ''
        });
        this.fetchLoad.set(false);
      },
      error: () => {
        this.error.set('Failed to load customer details.');
        this.fetchLoad.set(false);
      }
    });
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);

    const payload = {
      name:    this.form.value.name.trim(),
      phone:   this.form.value.phone?.trim()   || undefined,
      address: this.form.value.address?.trim() || undefined,
      notes:   this.form.value.notes?.trim()   || undefined
    };

    const request$ = this.isEdit
      ? this.customerService.update(this.customerId()!, payload)
      : this.customerService.create(payload);

    request$.subscribe({
      next: () => {
        this.loading.set(false);
        this.router.navigate(['/customers']);
      },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to save customer. Please try again.');
      }
    });
  }

  onCancel(): void {
    this.router.navigate(['/customers']);
  }
}