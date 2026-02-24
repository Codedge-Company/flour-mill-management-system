// src/app/shared/shared.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { ReactiveFormsModule } from '@angular/forms';

import { StatCardComponent }      from './components/stat-card/stat-card.component';
import { PageHeaderComponent }    from './components/page-header/page-header.component';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent }     from './components/data-table/data-table.component';
import { LkrCurrencyPipe }        from './pipes/lkr-currency.pipe';
import { StatusBadgePipe }        from './pipes/status-badge.pipe';
import { TimeAgoPipe }            from './pipes/time-ago.pipe';

const DECLARATIONS = [
  StatCardComponent,
  PageHeaderComponent,
  ConfirmDialogComponent,
  DataTableComponent,
  LkrCurrencyPipe,
  StatusBadgePipe,
  TimeAgoPipe
];

@NgModule({
  imports: [CommonModule, RouterModule, ReactiveFormsModule, ...DECLARATIONS],
  exports: [CommonModule, RouterModule, ReactiveFormsModule, ...DECLARATIONS]
})
export class SharedModule {}