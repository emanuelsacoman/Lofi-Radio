import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges
} from '@angular/core';

import { DailyVisitPoint } from 'src/app/services/analytics/visitor-analytics.models';
import { MatIconModule } from "@angular/material/icon";

interface ChartPoint extends DailyVisitPoint {
  x: number;
  y: number;
}

interface ChartTick {
  label: string;
  value: number;
  x?: number;
  y?: number;
}

@Component({
  selector: 'app-visits-trend-chart',
  templateUrl: './visits-trend-chart.component.html',
  styleUrls: ['./visits-trend-chart.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VisitsTrendChartComponent implements OnChanges {
  @Input() points: readonly DailyVisitPoint[] = [];

  readonly viewBoxWidth = 760;
  readonly viewBoxHeight = 280;
  readonly plotLeft = 52;
  readonly plotRight = 18;
  readonly plotTop = 18;
  readonly plotBottom = 42;

  chartPoints: ChartPoint[] = [];
  yTicks: ChartTick[] = [];
  xTicks: ChartTick[] = [];
  linePath = '';
  areaPath = '';
  totalVisits = 0;
  peakLabel = '';
  peakVisits = 0;
  chartAriaLabel = 'Gráfico de visitas dos últimos 30 dias sem dados disponíveis.';

  get plotWidth(): number {
    return this.viewBoxWidth - this.plotLeft - this.plotRight;
  }

  get plotHeight(): number {
    return this.viewBoxHeight - this.plotTop - this.plotBottom;
  }

  get baselineY(): number {
    return this.plotTop + this.plotHeight;
  }

  ngOnChanges(): void {
    this.buildChart();
  }

  trackByPointDate(_: number, point: ChartPoint): string {
    return point.date;
  }

  trackByTickValue(_: number, tick: ChartTick): string {
    return `${tick.label}-${tick.value}`;
  }

  private buildChart(): void {
    const normalizedPoints = this.points.map(point => ({
      ...point,
      visits: Number.isFinite(point.visits) ? Math.max(0, point.visits) : 0
    }));

    if (!normalizedPoints.length) {
      this.resetChart();
      return;
    }

    const rawMaximum = Math.max(...normalizedPoints.map(point => point.visits));
    const yMaximum = this.getNiceMaximum(rawMaximum);
    const lastIndex = normalizedPoints.length - 1;

    this.chartPoints = normalizedPoints.map((point, index) => {
      const xRatio = lastIndex === 0 ? 0.5 : index / lastIndex;
      const yRatio = point.visits / yMaximum;

      return {
        ...point,
        x: this.plotLeft + (xRatio * this.plotWidth),
        y: this.baselineY - (yRatio * this.plotHeight)
      };
    });

    this.linePath = this.chartPoints
      .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
      .join(' ');

    const firstPoint = this.chartPoints[0];
    const lastPoint = this.chartPoints[this.chartPoints.length - 1];
    this.areaPath = [
      `M ${firstPoint.x} ${this.baselineY}`,
      ...this.chartPoints.map(point => `L ${point.x} ${point.y}`),
      `L ${lastPoint.x} ${this.baselineY}`,
      'Z'
    ].join(' ');

    this.yTicks = Array.from({ length: 5 }, (_, index) => {
      const ratio = index / 4;
      const value = Math.round(yMaximum * (1 - ratio));

      return {
        value,
        label: this.formatCompactNumber(value),
        y: this.plotTop + (ratio * this.plotHeight)
      };
    });

    this.xTicks = this.buildXAxisTicks();
    this.totalVisits = normalizedPoints.reduce((total, point) => total + point.visits, 0);

    const peak = normalizedPoints.reduce((currentPeak, point) =>
      point.visits > currentPeak.visits ? point : currentPeak
    );

    this.peakLabel = peak.label;
    this.peakVisits = peak.visits;
    this.chartAriaLabel = `${this.totalVisits} visitas nos últimos ${normalizedPoints.length} dias. ` +
      `Maior movimento em ${this.peakLabel}, com ${this.peakVisits} visitas.`;
  }

  private buildXAxisTicks(): ChartTick[] {
    const lastIndex = this.chartPoints.length - 1;
    const indices = new Set<number>([0, lastIndex]);

    if (lastIndex > 1) {
      for (let step = 1; step < 4; step++) {
        indices.add(Math.round((lastIndex * step) / 4));
      }
    }

    return Array.from(indices)
      .sort((a, b) => a - b)
      .map(index => ({
        value: index,
        label: this.chartPoints[index].label,
        x: this.chartPoints[index].x
      }));
  }

  private getNiceMaximum(value: number): number {
    if (value <= 1) {
      return 1;
    }

    const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
    const normalized = value / magnitude;
    const niceNormalized = normalized <= 1
      ? 1
      : normalized <= 2
        ? 2
        : normalized <= 5
          ? 5
          : 10;

    return niceNormalized * magnitude;
  }

  private formatCompactNumber(value: number): string {
    return new Intl.NumberFormat('pt-BR', {
      notation: value >= 1000 ? 'compact' : 'standard',
      maximumFractionDigits: 1
    }).format(value);
  }

  private resetChart(): void {
    this.chartPoints = [];
    this.yTicks = [];
    this.xTicks = [];
    this.linePath = '';
    this.areaPath = '';
    this.totalVisits = 0;
    this.peakLabel = '';
    this.peakVisits = 0;
    this.chartAriaLabel = 'Gráfico de visitas dos últimos 30 dias sem dados disponíveis.';
  }
}
