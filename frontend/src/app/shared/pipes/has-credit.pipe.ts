import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'hasCredit',
  standalone: true, // or declare in a module instead
})
export class HasCreditPipe implements PipeTransform {
  transform(rows: { creditDue?: number }[] | null | undefined): boolean {
    if (!rows || !rows.length) return false;
    return rows.some(r => (r.creditDue ?? 0) > 0);
  }
}
