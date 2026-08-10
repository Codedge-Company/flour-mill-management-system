import {
    Component, OnInit, signal
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
    StockRequestService,
    StockRequest,
} from '../../../core/services/stock-request.service';

const ACTIVE_STATUSES = ['PENDING', 'APPROVED', 'PARTIALLY_FULFILLED'];

interface RequestUI extends StockRequest {
    editing: boolean;
    editQty: number;
    saving: boolean;
    deleting: boolean;
    showHistory: boolean;
}

@Component({
    selector: 'app-requested-stock-section',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './requested-stock-section.component.html',
    styleUrl: './requested-stock-section.component.css',
})
export class RequestedStockSectionComponent implements OnInit {

    requests: RequestUI[] = [];
    loading = signal(false);
    error = signal('');
    successMsg = signal('');

    deleteTarget = signal<RequestUI | null>(null);
    confirmingDelete = signal(false);
    deleteLoading = signal(false);

    constructor(private stockRequestService: StockRequestService) { }

    ngOnInit(): void {
        this.load();
    }

    load(): void {
        this.loading.set(true);
        this.error.set('');

        this.stockRequestService.getAll().subscribe({
            next: res => {
                this.requests = (res.data ?? [])
                    .filter(r => ACTIVE_STATUSES.includes(r.status))
                    .sort((a, b) =>
                        new Date(b.requestedAt).getTime() - new Date(a.requestedAt).getTime()
                    )
                    .map(r => ({
                        ...r,
                        editing: false,
                        editQty: r.qty,
                        saving: false,
                        deleting: false,
                        showHistory: false,
                    }));
                this.loading.set(false);
            },
            error: () => {
                this.error.set('Could not load stock requests.');
                this.loading.set(false);
            }
        });
    }

    // ── Edit ───────────────────────────────────────────────────────
    // Only allowed while nothing has been packed yet — the backend
    // rejects qty edits once a request is PARTIALLY_FULFILLED.

    canEdit(req: RequestUI): boolean {
        return req.status === 'PENDING' || req.status === 'APPROVED';
    }

    startEdit(req: RequestUI): void {
        if (!this.canEdit(req)) return;
        req.editing = true;
        req.editQty = req.qty;
    }

    cancelEdit(req: RequestUI): void {
        req.editing = false;
        req.editQty = req.qty;
    }

    saveEdit(req: RequestUI): void {
        if (!req.editQty || req.editQty <= 0) return;

        req.saving = true;

        this.stockRequestService.updateQty(req.stockRequestId, req.editQty).subscribe({
            next: () => {
                req.qty = req.editQty;
                req.editing = false;
                req.saving = false;
                this.showSuccess('Stock request updated.');
            },
            error: () => {
                req.saving = false;
            }
        });
    }

    toggleHistory(req: RequestUI): void {
        req.showHistory = !req.showHistory;
    }

    // ── Delete ─────────────────────────────────────────────────────

    confirmDelete(req: RequestUI): void {
        this.deleteTarget.set(req);
        this.confirmingDelete.set(true);
    }

    cancelDelete(): void {
        this.deleteTarget.set(null);
        this.confirmingDelete.set(false);
    }

    onDelete(): void {
        const req = this.deleteTarget();
        if (!req) return;

        this.deleteLoading.set(true);

        this.stockRequestService.deleteRequest(req.stockRequestId).subscribe({
            next: () => {
                this.requests = this.requests.filter(
                    r => r.stockRequestId !== req.stockRequestId
                );
                this.deleteTarget.set(null);
                this.confirmingDelete.set(false);
                this.deleteLoading.set(false);
                this.showSuccess('Stock request deleted.');
            },
            error: () => {
                this.deleteLoading.set(false);
            }
        });
    }

    // ── Helpers ────────────────────────────────────────────────────

    private showSuccess(msg: string): void {
        this.successMsg.set(msg);
        setTimeout(() => this.successMsg.set(''), 3000);
    }

    formatDate(iso: string): string {
        const d = new Date(iso);
        return d.toLocaleDateString('en-LK', {
            year: 'numeric', month: 'short', day: 'numeric'
        }) + ' ' + d.toLocaleTimeString('en-LK', {
            hour: '2-digit', minute: '2-digit', hour12: true
        });
    }

    statusColor(status: string): string {
        switch (status) {
            case 'PENDING': return 'rs-pill--pending';
            case 'APPROVED': return 'rs-pill--approved';
            case 'PARTIALLY_FULFILLED': return 'rs-pill--partial';
            default: return '';
        }
    }
}