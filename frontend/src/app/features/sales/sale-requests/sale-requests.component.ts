// sale-requests.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { SaleRequestService, SaleRequest } from '../../../core/services/sale-request.service';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-sale-requests',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './sale-requests.component.html',
  styleUrl: './sale-requests.component.css',
})
export class SaleRequestsComponent implements OnInit {

  pendingRequests = signal<SaleRequest[]>([]);
  allRequests = signal<SaleRequest[]>([]);
  loading = signal(true);
  activeTab = signal<'pending' | 'all'>('pending');

  // Approve/reject state
  processingId = signal<string | null>(null);
  rejectTarget = signal<SaleRequest | null>(null);
  rejectNote = signal('');
  successMsg = signal<string | null>(null);
  errorMsg = signal<string | null>(null);

  // Expand items
  expandedId = signal<string | null>(null);

  constructor(
    private saleRequestService: SaleRequestService,
    private authService: AuthService,
    private router: Router,
  ) { }

  ngOnInit(): void {
    this.load();
  }

load(): void {
  this.loading.set(true);

  this.saleRequestService.getPendingRequests().subscribe({
    next: data => {
      console.log('Pending sample:', data[0]);   // ← check _id exists
      this.pendingRequests.set(data);
      this.loading.set(false);
    },
    error: () => this.loading.set(false),
  });

  this.saleRequestService.getAllRequests(0, 50).subscribe({
    next: res => {
      console.log('All sample:', res.data?.[0]); // ← check _id exists
      this.allRequests.set(res.data ?? []);
    },
  });
}
  approve(req: SaleRequest): void {
    console.log('Approving req:', req);      // ← add this
    console.log('req._id:', req._id);        // ← add this
    this.processingId.set(req._id);
    this.errorMsg.set(null);
    this.saleRequestService.approve(req._id).subscribe({
      next: updated => {
        this.processingId.set(null);
        this.successMsg.set(`✅ Request ${updated.request_no} approved. The operator can now save the sale.`);
        setTimeout(() => this.successMsg.set(null), 5000);
        this.pendingRequests.update(list => list.filter(r => r._id !== req._id));
        this.allRequests.update(list => list.map(r => r._id === updated._id ? updated : r));
      },
      error: err => {
        this.processingId.set(null);
        this.errorMsg.set(err?.error?.message ?? 'Failed to approve request.');
      },
    });
  }

  openRejectDialog(req: SaleRequest): void {
    this.rejectTarget.set(req);
    this.rejectNote.set('');
  }

  closeRejectDialog(): void {
    this.rejectTarget.set(null);
    this.rejectNote.set('');
  }

  confirmReject(): void {
    const req = this.rejectTarget();
    if (!req) return;
    this.processingId.set(req._id);
    this.saleRequestService.reject(req._id, this.rejectNote()).subscribe({
      next: updated => {
        this.processingId.set(null);
        this.rejectTarget.set(null);
        this.successMsg.set(`Request ${updated.request_no} rejected.`);
        setTimeout(() => this.successMsg.set(null), 4000);
        this.pendingRequests.update(list => list.filter(r => r._id !== req._id));
        this.allRequests.update(list => list.map(r => r._id === updated._id ? updated : r));
      },
      error: err => {
        this.processingId.set(null);
        this.errorMsg.set(err?.error?.message ?? 'Failed to reject.');
      },
    });
  }

  toggleExpand(id: string): void {
    this.expandedId.set(this.expandedId() === id ? null : id);
  }

  currentList = (): SaleRequest[] =>
    this.activeTab() === 'pending' ? this.pendingRequests() : this.allRequests();

  statusClass(status: string): string {
    return ({ PENDING: 'badge-pending', APPROVED: 'badge-approved', REJECTED: 'badge-rejected', SAVED: 'badge-saved' } as any)[status] ?? '';
  }

  packName(item: SaleRequest['items'][0]): string {
    const p = item.pack_type_id;
    return typeof p === 'object' ? `${p.pack_name} (${p.weight_kg}kg)` : String(p);
  }

  formatLKR(n: number): string {
    return `LKR ${Number(n).toLocaleString('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleString('en-LK', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  get isAdmin(): boolean {
    return this.authService.currentUser()?.role === 'ADMIN';
  }
}
