import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { SaleCreditSummary } from '../../../core/models/payment.model';
import { PaymentApiService } from '../../../core/services/payment-api.service';
import { LkrCurrencyPipe } from '../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-add-payment-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, LkrCurrencyPipe],
  templateUrl: './add-payment-dialog.component.html',
  styleUrl: './add-payment-dialog.component.css'

})
export class AddPaymentDialogComponent implements OnInit {
  @Input()  summary!: SaleCreditSummary;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading  = signal(false);
  error    = signal<string | null>(null);
  readonly todayStr = new Date().toISOString().split('T')[0];

  constructor(private fb: FormBuilder, private paymentSvc: PaymentApiService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      amount:      [this.summary.balanceDue, [
        Validators.required,
        Validators.min(0.01),
        Validators.max(this.summary.balanceDue),
      ]],
      paymentDate: [this.todayStr, Validators.required],
      notes:       [''],
    });
  }

  get f() { return this.form.controls; }

  get remainingAfter(): number {
    return Math.max(0, this.summary.balanceDue - Number(this.form.get('amount')?.value ?? 0));
  }

  onSubmit(): void {
    if (this.form.invalid || this.loading()) return;
    this.error.set(null);
    this.loading.set(true);
    this.paymentSvc.addPayment({
      saleId:      this.summary.sale.saleId,
      amount:      this.form.value.amount,
      paymentDate: this.form.value.paymentDate,
      notes:       this.form.value.notes,
    }).subscribe({
      next: () => { this.loading.set(false); this.saved.emit(); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to record payment.');
      }
    });
  }
}