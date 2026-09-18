import { Component, Input, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-vehicle-no-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vehicle-no-dialog.component.html',
  styleUrl: './vehicle-no-dialog.component.css'
})
export class VehicleNoDialogComponent {
  @Input() saleNo = '';
  @Output() confirmed = new EventEmitter<string>();
  @Output() cancelled = new EventEmitter<void>();

  vehicleNo = signal('');
  touched = signal(false);

  get isInvalid(): boolean {
    return this.touched() && !this.vehicleNo().trim();
  }

  onConfirm(): void {
    this.touched.set(true);
    const value = this.vehicleNo().trim();
    if (!value) return;
    this.confirmed.emit(value);
  }
}