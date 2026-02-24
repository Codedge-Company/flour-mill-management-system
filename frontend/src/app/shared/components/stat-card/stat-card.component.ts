// src/app/shared/components/stat-card/stat-card.component.ts
import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LkrCurrencyPipe } from '../../pipes/lkr-currency.pipe';

export type StatCardVariant = 'primary' | 'success' | 'danger' | 'warning' | 'info';

@Component({
  selector: 'app-stat-card',
  standalone: true,
  imports: [CommonModule, LkrCurrencyPipe],
  templateUrl: './stat-card.component.html',
  styleUrl: './stat-card.component.css'
})
export class StatCardComponent {
  @Input() label    = '';
  @Input() value    = 0;
  @Input() prefix   = 'LKR';
  @Input() icon     = '';
  @Input() variant: StatCardVariant = 'primary';
  @Input() subLabel = '';
  @Input() isCurrency = true;
  @Input() loading  = false;
}