// src/app/shared/components/data-table/data-table.component.ts
import { Component, Input, Output, EventEmitter, ContentChild, TemplateRef } from '@angular/core';
import { CommonModule } from '@angular/common';

export interface TableColumn {
  key: string;
  label: string;
  sortable?: boolean;
  width?: string;
  align?: 'left' | 'center' | 'right';
}

@Component({
  selector: 'app-data-table',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './data-table.component.html',
  styleUrl: './data-table.component.css'
})
export class DataTableComponent {
  @Input() columns: TableColumn[] = [];
  @Input() data: any[]            = [];
  @Input() loading                = false;
  @Input() emptyMessage           = 'No records found.';
  @Input() trackByKey             = 'id';

  @Output() rowClick = new EventEmitter<any>();
  @Output() sort     = new EventEmitter<{ key: string; direction: 'asc' | 'desc' }>();

  @ContentChild('rowTemplate') rowTemplate!: TemplateRef<any>;

  sortKey       = '';
  sortDirection: 'asc' | 'desc' = 'asc';

  onSort(col: TableColumn): void {
    if (!col.sortable) return;
    if (this.sortKey === col.key) {
      this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = col.key;
      this.sortDirection = 'asc';
    }
    this.sort.emit({ key: this.sortKey, direction: this.sortDirection });
  }

  trackFn = (index: number, item: any) => item[this.trackByKey] ?? index;
}