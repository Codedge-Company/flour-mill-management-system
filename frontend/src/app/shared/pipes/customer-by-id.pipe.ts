
import { Pipe, PipeTransform } from '@angular/core';
import { Customer } from '../../core/models/customer';

@Pipe({
  name: 'customerById',
  standalone: true
})
export class CustomerByIdPipe implements PipeTransform {
  transform(customers: Customer[], id: number | null): Customer | null {
    return id ? customers.find(c => c.customerId === id) || null : null;
  }
}