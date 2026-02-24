// src/app/shared/pipes/time-ago.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'timeAgo', standalone: true })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | Date | null): string {
    if (!value) return '—';

    const now  = new Date();
    const date = new Date(value);
    const diffMs = now.getTime() - date.getTime();
    const diffMins  = Math.floor(diffMs / 60_000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays  = Math.floor(diffHours / 24);

    if (diffMins  < 1)   return 'Just now';
    if (diffMins  < 60)  return `${diffMins}m ago`;
    if (diffHours < 24)  return `${diffHours}h ago`;
    if (diffDays  < 7)   return `${diffDays}d ago`;

    return date.toLocaleDateString('en-LK', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  }
}