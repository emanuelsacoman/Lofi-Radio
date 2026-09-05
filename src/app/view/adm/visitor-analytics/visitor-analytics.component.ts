import { ChangeDetectionStrategy, Component } from '@angular/core';
import { Observable } from 'rxjs';

import {
  VisitRecord,
  VisitorAnalyticsState,
  VisitorDeviceCategory
} from 'src/app/services/analytics/visitor-analytics.models';
import { VisitorAnalyticsService } from 'src/app/services/analytics/visitor-analytics.service';

@Component({
  selector: 'app-visitor-analytics',
  templateUrl: './visitor-analytics.component.html',
  styleUrls: ['./visitor-analytics.component.css'],
  providers: [VisitorAnalyticsService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class VisitorAnalyticsComponent {
  readonly dashboard$: Observable<VisitorAnalyticsState>;

  constructor(visitorAnalyticsService: VisitorAnalyticsService) {
    this.dashboard$ = visitorAnalyticsService.dashboard$;
  }

  trackByVisitId(_: number, visit: VisitRecord): string {
    return visit.id;
  }

  formatLocation(visit: VisitRecord): string {
    const parts = [visit.geo.city, visit.geo.region, visit.geo.country]
      .map(part => part?.trim())
      .filter((part, index, values): part is string => Boolean(part) && values.indexOf(part) === index);

    return parts.join(', ') || 'Localização não identificada';
  }

  formatReferrer(referrerHost: string): string {
    return referrerHost?.trim() || 'Acesso direto';
  }

  formatDevice(device: VisitorDeviceCategory): string {
    switch (device) {
      case 'desktop':
        return 'Desktop';
      case 'mobile':
        return 'Celular';
      case 'tablet':
        return 'Tablet';
      default:
        return 'Desconhecido';
    }
  }

  deviceIcon(device: VisitorDeviceCategory): string {
    switch (device) {
      case 'desktop':
        return 'desktop_windows';
      case 'mobile':
        return 'smartphone';
      case 'tablet':
        return 'tablet_mac';
      default:
        return 'devices_other';
    }
  }
}
