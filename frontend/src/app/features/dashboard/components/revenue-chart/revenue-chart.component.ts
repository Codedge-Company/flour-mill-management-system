// src/app/features/dashboard/components/revenue-chart/revenue-chart.component.ts
import {
  Component, Input, OnChanges, ViewChild,
  ElementRef, AfterViewInit, SimpleChanges
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DailyMetric } from '../../../../core/models/dashboard';

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="chart-wrap">
      <canvas #chartCanvas></canvas>
      <div class="chart-legend">
        <span class="legend-item revenue">Revenue</span>
        <span class="legend-item cost">Cost</span>
        <span class="legend-item profit">Profit</span>
      </div>
    </div>
  `,
  styles: [`
    .chart-wrap {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    canvas {
      width: 100% !important;
      height: 250px;
      display: block;
    }
    .chart-legend {
      display: flex;
      gap: 16px;
      justify-content: center;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 12px;
      font-weight: 500;
      color: var(--text-secondary);
    }
    .legend-item::before {
      content: '';
      width: 12px;
      height: 3px;
      border-radius: 2px;
      display: inline-block;
    }
    .legend-item.revenue::before { background: #2563eb; }
    .legend-item.cost::before    { background: #d97706; }
    .legend-item.profit::before  { background: #16a34a; }
  `]
})
export class RevenueChartComponent implements OnChanges, AfterViewInit {
  @Input() metrics: DailyMetric[] = [];
  @ViewChild('chartCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private ctx!: CanvasRenderingContext2D;
  private ready = false;

  ngAfterViewInit(): void {
    this.ctx   = this.canvasRef.nativeElement.getContext('2d')!;
    this.ready = true;
    this.draw();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (this.ready && changes['metrics']) this.draw();
  }

  private draw(): void {
    if (!this.ctx || !this.metrics.length) return;

    const canvas = this.canvasRef.nativeElement;
    const dpr    = window.devicePixelRatio || 1;
    const W      = canvas.offsetWidth;
    const H      = 250;

    canvas.width  = W * dpr;
    canvas.height = H * dpr;
    this.ctx.scale(dpr, dpr);

    const pad    = { top: 20, right: 20, bottom: 40, left: 70 };
    const chartW = W - pad.left - pad.right;
    const chartH = H - pad.top - pad.bottom;

    // Clear
    this.ctx.clearRect(0, 0, W, H);

    const allValues = this.metrics.flatMap(m => [m.revenue, m.cost, m.profit]);
    const maxVal    = Math.max(...allValues) * 1.1 || 1;
    const minVal    = Math.min(0, Math.min(...allValues));

    const xStep = chartW / Math.max(this.metrics.length - 1, 1);
    const yScale = (v: number) =>
      pad.top + chartH - ((v - minVal) / (maxVal - minVal)) * chartH;
    const xScale = (i: number) =>
      pad.left + (this.metrics.length === 1 ? chartW / 2 : i * xStep);

    // Grid lines
    const gridCount = 5;
    this.ctx.strokeStyle = '#e5e7eb';
    this.ctx.lineWidth   = 1;
    this.ctx.fillStyle   = '#6b7280';
    this.ctx.font        = '11px Inter, sans-serif';
    this.ctx.textAlign   = 'right';

    for (let g = 0; g <= gridCount; g++) {
      const v = minVal + ((maxVal - minVal) * g) / gridCount;
      const y = yScale(v);
      this.ctx.beginPath();
      this.ctx.moveTo(pad.left, y);
      this.ctx.lineTo(pad.left + chartW, y);
      this.ctx.stroke();
      this.ctx.fillText(this.formatK(v), pad.left - 6, y + 4);
    }

    // X labels
    this.ctx.textAlign  = 'center';
    this.ctx.fillStyle  = '#6b7280';

    const maxLabels = Math.min(this.metrics.length, 7);
    const step      = Math.ceil(this.metrics.length / maxLabels);
    this.metrics.forEach((m, i) => {
      if (i % step !== 0 && i !== this.metrics.length - 1) return;
      const x = xScale(i);
      const d = new Date(m.date);
      const label = `${d.getDate()}/${d.getMonth() + 1}`;
      this.ctx.fillText(label, x, H - pad.bottom + 16);
    });

    // Draw lines
    this.drawLine(xScale, yScale, 'revenue', '#2563eb');
    this.drawLine(xScale, yScale, 'cost',    '#d97706');
    this.drawLine(xScale, yScale, 'profit',  '#16a34a');
  }

  private drawLine(
    xScale: (i: number) => number,
    yScale: (v: number) => number,
    key: 'revenue' | 'cost' | 'profit',
    color: string
  ): void {
    const ctx = this.ctx;
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth   = 2.5;
    ctx.lineJoin    = 'round';

    this.metrics.forEach((m, i) => {
      const x = xScale(i);
      const y = yScale(m[key]);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    this.metrics.forEach((m, i) => {
      const x = xScale(i);
      const y = yScale(m[key]);
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.lineWidth   = 1.5;
      ctx.stroke();
    });
  }

  private formatK(v: number): string {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000)     return `${(v / 1_000).toFixed(1)}K`;
    return v.toFixed(0);
  }
}