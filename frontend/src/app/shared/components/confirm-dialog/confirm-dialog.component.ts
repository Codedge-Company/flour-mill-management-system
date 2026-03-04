// src/app/shared/components/confirm-dialog/confirm-dialog.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';

export type DialogVariant = 'danger' | 'warning' | 'primary' | 'info';

@Component({
  selector: 'app-confirm-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirm-dialog.component.html',
  styleUrl: './confirm-dialog.component.css'
})
export class ConfirmDialogComponent {
  @Input() title        = 'Confirm';
  @Input() message      = 'Are you sure?';
  @Input() confirmLabel = 'Confirm';
  @Input() cancelLabel  = 'Cancel';
  @Input() variant: DialogVariant = 'danger';
  @Input() loading      = false;

  @Output() confirmed = new EventEmitter<void>();
  @Output() cancelled = new EventEmitter<void>();

  get confirmClass(): string {
    const map: Record<DialogVariant, string> = {
      danger:  'btn-danger',
      warning: 'btn-warning',
      primary: 'btn-primary',  // ← was missing, caused TS2741
      info:    'btn-primary',
    };
    return map[this.variant];
  }
}