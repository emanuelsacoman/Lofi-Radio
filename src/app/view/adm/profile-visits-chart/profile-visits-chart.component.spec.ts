import { registerLocaleData } from '@angular/common';
import localePt from '@angular/common/locales/pt';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Subject } from 'rxjs';
import { ProfileVisitStat, getVisitDateKey } from 'src/app/services/interfaces/profile-visit-stat';
import { ProfileVisitsService } from 'src/app/services/profile-visits.service';
import { ProfileVisitsChartComponent } from './profile-visits-chart.component';

describe('ProfileVisitsChartComponent', () => {
  let fixture: ComponentFixture<ProfileVisitsChartComponent>;
  let component: ProfileVisitsChartComponent;
  let stats: Subject<ProfileVisitStat[]>;
  let visits: jasmine.SpyObj<ProfileVisitsService>;
  const relativeDay = (offset: number): string => {
    const date = new Date();
    date.setUTCDate(date.getUTCDate() + offset);
    return getVisitDateKey(date);
  };

  beforeEach(async () => {
    registerLocaleData(localePt, 'pt-BR');
    stats = new Subject();
    visits = jasmine.createSpyObj('ProfileVisitsService', ['getProfileVisitStats']);
    visits.getProfileVisitStats.and.returnValue(stats);
    await TestBed.configureTestingModule({
      imports: [ProfileVisitsChartComponent],
      providers: [{ provide: ProfileVisitsService, useValue: visits }]
    }).compileComponents();
    fixture = TestBed.createComponent(ProfileVisitsChartComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('shows loading, then an honest empty state without a fabricated curve', () => {
    expect(fixture.nativeElement.textContent).toContain('Carregando sua audiência');
    stats.next([]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Ainda não há visitas');
    expect(fixture.nativeElement.querySelector('svg')).toBeNull();
  });

  it('sorts dates, fills gaps and limits totals to the selected calendar window', () => {
    stats.next([
      { date: relativeDay(0), visits: 3 },
      { date: relativeDay(-20), visits: 100 },
      { date: relativeDay(-2), visits: 5 },
      { date: relativeDay(1), visits: 50 }
    ]);
    expect(component.points.length).toBe(14);
    expect(component.points[0].date).toBe(relativeDay(-13));
    expect(component.points[12].visits).toBe(0);
    expect(component.todayProfileVisitors).toBe(3);
    expect(component.totalProfileVisitors).toBe(8);
    expect(component.dailyAverage).toBe(8 / 14);
    component.selectPeriod(30);
    expect(component.totalProfileVisitors).toBe(108);
    expect(component.points.length).toBe(30);
  });

  it('sanitizes invalid counts and never builds NaN chart coordinates', () => {
    stats.next([
      { date: relativeDay(0), visits: NaN },
      { date: relativeDay(-1), visits: -10 },
      { date: relativeDay(-2), visits: Infinity },
      { date: relativeDay(-3), visits: 2.9 }
    ]);
    expect(component.totalProfileVisitors).toBe(2);
    expect(component.points.every(point => Number.isFinite(point.y))).toBeTrue();
    expect(component.ticks.every(tick => Number.isInteger(tick.value))).toBeTrue();
  });

  it('renders a real chart, supports point focus and exposes a daily data table', () => {
    stats.next([{ date: relativeDay(-1), visits: 12 }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.data-line').getAttribute('d')).toContain('L');
    const buttons = fixture.nativeElement.querySelectorAll('.chart-point');
    buttons[12].dispatchEvent(new Event('focus'));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.point-detail').textContent).toContain('12 visitas');
    expect(fixture.nativeElement.querySelectorAll('tbody tr').length).toBe(14);
  });

  it('switches periods through the rendered controls', () => {
    stats.next([{ date: relativeDay(0), visits: 1 }]);
    fixture.detectChanges();
    fixture.nativeElement.querySelector('.period-picker button').click();
    fixture.detectChanges();
    expect(component.selectedPeriod).toBe(7);
    expect(fixture.nativeElement.querySelectorAll('.chart-point').length).toBe(7);
    expect(fixture.nativeElement.querySelector('.period-picker button').getAttribute('aria-pressed')).toBe('true');
  });

  it('distinguishes an error from zero visitors and supports retry', () => {
    stats.error({ code: 'permission-denied' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    expect(fixture.nativeElement.textContent).toContain('O Firebase negou o acesso ao histórico');
    expect(fixture.nativeElement.querySelector('.chart-summary')).toBeNull();
    const retryStats = new Subject<ProfileVisitStat[]>();
    visits.getProfileVisitStats.and.returnValue(retryStats);
    fixture.nativeElement.querySelector('.retry-button').click();
    retryStats.next([{ date: relativeDay(0), visits: 4 }]);
    fixture.detectChanges();
    expect(component.todayProfileVisitors).toBe(4);
    expect(component.error).toBeFalse();
  });

  it('releases its live data subscription when removed', () => {
    expect(stats.observed).toBeTrue();
    fixture.destroy();
    expect(stats.observed).toBeFalse();
  });
});
