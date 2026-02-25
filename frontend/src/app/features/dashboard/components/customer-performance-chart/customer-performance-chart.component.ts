// src/app/features/dashboard/components/customer-performance-chart/customer-performance-chart.component.ts
import { Component, Input, OnChanges, ViewChild, ElementRef, AfterViewInit, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CustomerPerformance } from '../../../../core/models/dashboard';
import { LkrCurrencyPipe } from '../../../../shared/pipes/lkr-currency.pipe';

@Component({
  selector: 'app-customer-performance-chart',
  standalone: true,
  imports: [CommonModule, LkrCurrencyPipe],
  template: `
    <div class="perf-wrap">
      <canvas #chartCanvas></canvas>
      <div class="perf-table">
        <table>
          <thead>
            <tr>
              <th>Customer</th>
              <th class="num">Revenue</th>
              <th class="num">Sales</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data; track row.customerId || $index) {
              <tr>
                <td>{{ row.customerName }}</td>
                <td class="num">{{ row.revenue | lkrCurrency }}</td>
                <td class="num">{{ row.salesCount }}</td>
              </tr>
            }
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .perf-wrap { display: flex; flex-direction: column; gap: 20px; }
    canvas { width: 100% !important; height: 220px; display: block; }
    .perf-table { overflow-x: auto; }
    .num { text-align: right; }
  `]
})
export class CustomerPerformanceChartComponent implements OnChanges, AfterViewInit {
  @Input() data: CustomerPerformance[] = [];
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private ready = false;

  ngAfterViewInit(): void {
    this.ctx = this.canvasRef.nativeElement.getContext('2d')!;
    this.ready = true;
    this.draw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.ready && changes['data']) this.draw();
  }

  private draw(): void {
    if (!this.ctx || !this.data.length) return;

    const canvas = this.canvasRef.nativeElement;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.offsetWidth;
    const H = 220;

    canvas.width = W * dpr;
    canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);

    const pad = { top: 20, right: 20, bottom: 50, left: 70 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    this.ctx.clearRect(0, 0, W, H);

    // ✅ Use correct property names
    const sorted = [...this.data].sort((a, b) => b.revenue - a.revenue);
    const maxVal = Math.max(...sorted.map(d => d.revenue)) * 1.1 || 1;

    const barGroupW = chartW / sorted.length;
    const barW = Math.min(barGroupW * 0.35, 32);
    const gap = 4;

    // Grid (unchanged)
    const gridCount = 4;
    this.ctx.strokeStyle = '#e5e7eb';
    this.ctx.lineWidth = 1;
    this.ctx.fillStyle = '#6b7280';
    this.ctx.font = '11px Inter, sans-serif';
    this.ctx.textAlign = 'right';

    for (let g = 0; g <= gridCount; g++) {
      const v = (maxVal * g) / gridCount;
      const y = pad.top + chartH - (v / maxVal) * chartH;
      this.ctx.beginPath();
      this.ctx.moveTo(pad.left, y);
      this.ctx.lineTo(pad.left + chartW, y);
      this.ctx.stroke();
      this.ctx.fillText(this.formatK(v), pad.left - 6, y + 4);
    }

    // ✅ Fixed property names
    sorted.forEach((d, i) => {
      const groupX = pad.left + i * barGroupW + barGroupW / 2;
      const revH = (d.revenue / maxVal) * chartH;
      // No profit data - just revenue bars
      const revX = groupX - barW / 2;

      // Revenue bar only
      this.ctx.fillStyle = '#2563eb';
      this.ctx.fillRect(revX, pad.top + chartH - revH, barW, revH);

      // Customer label
      this.ctx.fillStyle = '#6b7280';
      this.ctx.textAlign = 'center';
      this.ctx.font = '10px Inter, sans-serif';
      const name = d.customerName.length > 10
        ? d.customerName.substring(0, 10) + '…'
        : d.customerName;
      this.ctx.fillText(name, groupX, H - pad.bottom + 16);
    });

    // Legend (Revenue only)
    const legendY = H - 10;
    const lx = pad.left;
    this.ctx.fillStyle = '#2563eb';
    this.ctx.fillRect(lx, legendY - 8, 14, 8);
    this.ctx.fillStyle = '#6b7280';
    this.ctx.textAlign = 'left';
    this.ctx.font = '11px Inter, sans-serif';
    this.ctx.fillText('Revenue', lx + 18, legendY);
  }

  private formatK(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }
}
