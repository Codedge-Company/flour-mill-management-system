import { Component, Input, Output, EventEmitter, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { InventoryItem } from '../../../core/models/inventory';
import { InventoryService } from '../../../core/services/inventory.service';

@Component({
  selector: 'app-edit-stock-dialog',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './edit-stock-dialog.component.html',
  styleUrl: './edit-stock-dialog.component.css'
})
export class EditStockDialogComponent implements OnInit {
  @Input() item!: InventoryItem;
  @Output() saved     = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  form!: FormGroup;
  loading = signal(false);
  error   = signal<string | null>(null);

  constructor(private fb: FormBuilder, private inventoryService: InventoryService) {}

  ngOnInit(): void {
    this.form = this.fb.group({
      setQty: [
        this.item.stockQty,
        [Validators.required, Validators.min(0), Validators.max(999999)]
      ],
      reason: ['Data Entry Mistake', [Validators.required, Validators.minLength(3), Validators.maxLength(200)]]
    });
  }

  get diff(): number {
    return (this.form.get('setQty')?.value ?? 0) - this.item.stockQty;
  }

  get diffLabel(): string {
    if (this.diff === 0) return 'No change';
    return this.diff > 0 ? `+${this.diff} packs` : `${this.diff} packs`;
  }

  get diffClass(): string {
    if (this.diff === 0) return 'diff-neutral';
    return this.diff > 0 ? 'diff-positive' : 'diff-negative';
  }

  get f() { return this.form.controls; }

  onSubmit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.loading()) return;

    // No-op guard — no change, just close
    if (this.diff === 0) { this.cancelled.emit(); return; }

    this.error.set(null);
    this.loading.set(true);

    this.inventoryService.setStock(this.item.packTypeId, this.form.value.setQty).subscribe({
      next: () => { this.loading.set(false); this.saved.emit(); },
      error: err => {
        this.loading.set(false);
        this.error.set(err?.error?.message ?? 'Failed to update stock.');
      }
    });
  }
}