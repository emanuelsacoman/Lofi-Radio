import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Subscription } from 'rxjs';
import { getVisitDateKey, ProfileVisitStat } from 'src/app/services/interfaces/profile-visit-stat';
import { ProfileVisitsService } from 'src/app/services/profile-visits.service';

interface VisitPoint extends ProfileVisitStat {
  label: string;
  fullLabel: string;
  x: number;
  y: number;
}

@Component({
  selector: 'app-profile-visits-chart',
  standalone: true,
  imports: [CommonModule, MatIconModule],
  templateUrl: './profile-visits-chart.component.html',
  styleUrls: ['./profile-visits-chart.component.css']
})
export class ProfileVisitsChartComponent implements OnInit, OnDestroy {
  readonly periods = [7, 14, 30];
  selectedPeriod = 14;
  profileVisitStats: ProfileVisitStat[] = [];
  points: VisitPoint[] = [];
  ticks: { value: number; y: number }[] = [];
  axisLabels: VisitPoint[] = [];
  selectedPoint?: VisitPoint;
  linePath = '';
  areaPath = '';
  loading = true;
  error = false;
  errorMessage = '';
  private subscription?: Subscription;

  constructor(private visits: ProfileVisitsService) {}

  ngOnInit(): void { this.loadVisits(); }
  ngOnDestroy(): void { this.subscription?.unsubscribe(); }

  get totalProfileVisitors(): number {
    return this.points.reduce((total, item) => total + item.visits, 0);
  }

  get todayProfileVisitors(): number {
    return this.points.find(item => item.date === getVisitDateKey())?.visits || 0;
  }

  get dailyAverage(): number { return this.totalProfileVisitors / this.selectedPeriod; }
  get peakVisitors(): number { return Math.max(0, ...this.points.map(point => point.visits)); }
  get periodLabel(): string {
    return this.points.length ? `${this.points[0].label} — ${this.points[this.points.length - 1].label}` : '';
  }

  loadVisits(): void {
    this.subscription?.unsubscribe();
    this.loading = true;
    this.error = false;
    this.errorMessage = '';
    this.subscription = this.visits.getProfileVisitStats().subscribe({
      next: stats => {
        this.profileVisitStats = stats;
        this.buildChart();
        this.loading = false;
      },
      error: (error: unknown) => {
        this.loading = false;
        this.error = true;
        const code = (error as { code?: string } | null)?.code || 'unknown';
        this.errorMessage = code === 'permission-denied'
          ? 'O Firebase negou o acesso ao histórico. Verifique a sessão de administrador e as permissões de leitura.'
          : code === 'unauthenticated'
            ? 'Sua sessão expirou. Entre novamente no admin para consultar as visitas.'
            : 'Não foi possível consultar o histórico. Verifique sua conexão e tente novamente.';
        console.warn('[Visitas] Falha ao consultar o histórico:', code);
        this.points = [];
        this.selectedPoint = undefined;
      }
    });
  }

  selectPeriod(days: number): void {
    this.selectedPeriod = days;
    this.buildChart();
  }

  trackDate(_: number, point: VisitPoint): string { return point.date; }

  private buildChart(): void {
    const counts = new Map(this.profileVisitStats.map(item => {
      const count = Number(item.visits);
      return [item.date, Number.isFinite(count) ? Math.max(0, Math.trunc(count)) : 0];
    }));
    const today = new Date();
    this.points = Array.from({ length: this.selectedPeriod }, (_, index) => {
      const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - this.selectedPeriod + index + 1));
      const date = getVisitDateKey(day);
      return {
        date,
        visits: counts.get(date) || 0,
        label: day.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'UTC' }),
        fullLabel: day.toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }),
        x: index / (this.selectedPeriod - 1) * 1000,
        y: 0
      };
    });
    const step = Math.max(1, Math.ceil(this.peakVisitors / 4));
    const ceiling = step * 4;
    this.points.forEach(point => point.y = 200 - point.visits / ceiling * 180);
    this.ticks = Array.from({ length: 5 }, (_, index) => ({ value: step * (4 - index), y: 20 + index * 45 }));
    this.linePath = this.points.map((point, index) => `${index ? 'L' : 'M'} ${point.x} ${point.y}`).join(' ');
    this.areaPath = `${this.linePath} L 1000 200 L 0 200 Z`;
    this.axisLabels = this.points.filter((_, index) => index === 0 || index === this.points.length - 1 || index === Math.round((this.points.length - 1) / 2));
    this.selectedPoint = this.points.find(point => point.date === this.selectedPoint?.date) || this.points[this.points.length - 1];
  }
}
