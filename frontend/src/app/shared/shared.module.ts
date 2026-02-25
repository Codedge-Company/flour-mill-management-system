import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { DataTableComponent } from './components/data-table/data-table.component';
import { PageHeaderComponent } from './components/page-header/page-header.component';
import { StatCardComponent } from './components/stat-card/stat-card.component';
import { CustomerByIdPipe } from './pipes/customer-by-id.pipe';
import { LkrCurrencyPipe } from './pipes/lkr-currency.pipe';
import { StatusBadgePipe } from './pipes/status-badge.pipe';
import { TimeAgoPipe } from './pipes/time-ago.pipe';

// add to DECLARATIONS array:
const DECLARATIONS = [
  StatCardComponent,
  PageHeaderComponent,
  ConfirmDialogComponent,
  DataTableComponent,
  LkrCurrencyPipe,
  StatusBadgePipe,
  TimeAgoPipe,
  CustomerByIdPipe  
];