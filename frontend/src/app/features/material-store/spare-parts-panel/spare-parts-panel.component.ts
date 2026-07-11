import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SparePartService } from '../../../core/services/spare-part.service';
import { SparePart } from '../../../core/models/spare-part';

@Component({
  selector: 'app-spare-parts-panel',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './spare-parts-panel.component.html',
  styleUrl: './spare-parts-panel.component.css',
})
export class SparePartsPanelComponent implements OnInit {
  items = signal<SparePart[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);
  success = signal<string | null>(null);

  showAddForm = signal(false);
  saving = signal(false);

  newPart = {
    name: '', category: '', unit: 'pcs', qty: 0, threshold_qty: 0, supplier_notes: ''
  };

  qtyEditId = signal<string | null>(null);
  qtyEditValue = 0;

  constructor(private sparePartSvc: SparePartService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);
    this.sparePartSvc.getAll().subscribe({
      next: res => { this.items.set(res.data); this.loading.set(false); },
      error: () => { this.error.set('Failed to load spare parts.'); this.loading.set(false); },
    });
  }

  get lowStockCount(): number {
    return this.items().filter(i => i.isLowStock).length;
  }

  toggleAddForm(): void {
    this.showAddForm.set(!this.showAddForm());
  }

  submitNewPart(): void {
    if (!this.newPart.name.trim()) return;
    this.saving.set(true);
    this.sparePartSvc.create({
      name: this.newPart.name,
      category: this.newPart.category || 'General',
      unit: this.newPart.unit || 'pcs',
      qty: Number(this.newPart.qty) || 0,
      threshold_qty: Number(this.newPart.threshold_qty) || 0,
      supplier_notes: this.newPart.supplier_notes || '',
    }).subscribe({
      next: () => {
        this.saving.set(false);
        this.showAddForm.set(false);
        this.newPart = { name: '', category: '', unit: 'pcs', qty: 0, threshold_qty: 0, supplier_notes: '' };
        this.showSuccess('Spare part added.');
        this.load();
      },
      error: () => { this.saving.set(false); this.error.set('Failed to add spare part.'); },
    });
  }

  startQtyEdit(item: SparePart): void {
    this.qtyEditId.set(item.sparePartId);
    this.qtyEditValue = item.qty;
  }

  cancelQtyEdit(): void {
    this.qtyEditId.set(null);
  }

  saveQty(item: SparePart): void {
    this.sparePartSvc.setQty(item.sparePartId, Number(this.qtyEditValue)).subscribe({
      next: () => { this.qtyEditId.set(null); this.showSuccess('Quantity updated.'); this.load(); },
      error: () => { this.error.set('Failed to update quantity.'); },
    });
  }

  adjustQty(item: SparePart, delta: number): void {
    this.sparePartSvc.addQty(item.sparePartId, delta).subscribe({
      next: () => this.load(),
      error: () => { this.error.set('Failed to update quantity.'); },
    });
  }

  deletePart(item: SparePart): void {
    if (!confirm(`Remove "${item.name}" from spare parts?`)) return;
    this.sparePartSvc.remove(item.sparePartId).subscribe({
      next: () => { this.showSuccess('Spare part removed.'); this.load(); },
      error: () => { this.error.set('Failed to delete spare part.'); },
    });
  }

  private showSuccess(msg: string): void {
    this.success.set(msg);
    setTimeout(() => this.success.set(null), 3000);
  }
}
