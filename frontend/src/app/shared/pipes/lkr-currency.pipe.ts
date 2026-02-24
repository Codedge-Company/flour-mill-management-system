// src/app/shared/pipes/lkr-currency.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'lkrCurrency', standalone: true })
export class LkrCurrencyPipe implements PipeTransform {
  transform(value: number | null | undefined, showSymbol = true): string {
    if (value == null) return showSymbol ? 'LKR 0.00' : '0.00';

    const formatted = new Intl.NumberFormat('en-LK', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(value);

    return showSymbol ? `LKR ${formatted}` : formatted;
  }
}