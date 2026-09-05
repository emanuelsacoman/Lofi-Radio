import { ActiveVisitor, DailyVisitPoint } from 'src/app/services/analytics/visitor-analytics.models';
import { LiveWorldMapComponent } from './live-world-map.component';
import { VisitsTrendChartComponent } from './visits-trend-chart.component';

describe('Visitor analytics visualizations', () => {
  it('projects the geographic center to the center of the map', () => {
    const component = new LiveWorldMapComponent();
    component.visitors = [createVisitor('center', 0, 0)];

    component.ngOnChanges();

    expect(component.markers.length).toBe(1);
    expect(component.markers[0].x).toBe(480);
    expect(component.markers[0].y).toBe(240);
    expect(component.mappedVisitorsCount).toBe(1);
  });

  it('groups nearby map points and keeps track of visitors without coordinates', () => {
    const component = new LiveWorldMapComponent();
    component.visitors = [
      createVisitor('first', -23.5, -46.6),
      createVisitor('second', -23.4, -46.5),
      createVisitor('unknown', null, null)
    ];

    component.ngOnChanges();

    expect(component.markers.length).toBe(1);
    expect(component.markers[0].count).toBe(2);
    expect(component.mappedVisitorsCount).toBe(2);
    expect(component.unlocatedVisitorsCount).toBe(1);
  });

  it('builds a complete accessible trend path and finds the peak', () => {
    const component = new VisitsTrendChartComponent();
    component.points = createDailyPoints();

    component.ngOnChanges();

    expect(component.chartPoints.length).toBe(30);
    expect(component.linePath.startsWith('M ')).toBeTrue();
    expect(component.areaPath.endsWith('Z')).toBeTrue();
    expect(component.totalVisits).toBe(35);
    expect(component.peakVisits).toBe(6);
    expect(component.peakLabel).toBe('30/08');
    expect(component.chartAriaLabel).toContain('35 visitas');
  });

  it('resets the trend when no points are supplied', () => {
    const component = new VisitsTrendChartComponent();
    component.points = [];

    component.ngOnChanges();

    expect(component.chartPoints).toEqual([]);
    expect(component.linePath).toBe('');
    expect(component.totalVisits).toBe(0);
  });

  function createVisitor(
    id: string,
    latitude: number | null,
    longitude: number | null
  ): ActiveVisitor {
    return {
      id,
      sessionId: `session-${id}`,
      connectedAt: Date.now(),
      lastSeenAt: Date.now(),
      path: '/',
      referrerHost: '',
      language: 'pt-BR',
      deviceCategory: 'desktop',
      geo: {
        city: latitude === null ? '' : 'São Paulo',
        region: latitude === null ? '' : 'SP',
        country: latitude === null ? '' : 'Brasil',
        countryCode: latitude === null ? '' : 'BR',
        latitude,
        longitude,
        timezone: '',
        flag: ''
      }
    };
  }

  function createDailyPoints(): DailyVisitPoint[] {
    return Array.from({ length: 30 }, (_, index) => ({
      date: `2026-08-${String(index + 1).padStart(2, '0')}`,
      label: `${String(index + 1).padStart(2, '0')}/08`,
      visits: index === 29 ? 6 : 1
    }));
  }
});
