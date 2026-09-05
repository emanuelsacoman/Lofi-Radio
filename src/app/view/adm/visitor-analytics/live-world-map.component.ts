import {
  ChangeDetectionStrategy,
  Component,
  Input,
  OnChanges
} from '@angular/core';

import { ActiveVisitor } from 'src/app/services/analytics/visitor-analytics.models';

interface MarkerAccumulator {
  latitudeTotal: number;
  longitudeTotal: number;
  count: number;
  city: string;
  country: string;
}

interface WorldMapMarker {
  id: string;
  x: number;
  y: number;
  radius: number;
  count: number;
  label: string;
}

@Component({
  selector: 'app-live-world-map',
  templateUrl: './live-world-map.component.html',
  styleUrls: ['./live-world-map.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class LiveWorldMapComponent implements OnChanges {
  @Input() visitors: readonly ActiveVisitor[] = [];

  readonly viewBoxWidth = 960;
  readonly viewBoxHeight = 480;
  markers: WorldMapMarker[] = [];
  mappedVisitorsCount = 0;
  unlocatedVisitorsCount = 0;
  mapAriaLabel = 'Mapa mundial sem visitantes online localizados.';

  ngOnChanges(): void {
    this.buildMarkers();
  }

  trackByMarkerId(_: number, marker: WorldMapMarker): string {
    return marker.id;
  }

  private buildMarkers(): void {
    const groups = new Map<string, MarkerAccumulator>();
    let unlocatedVisitors = 0;

    this.visitors.forEach(visitor => {
      const latitude = visitor.geo.latitude;
      const longitude = visitor.geo.longitude;

      if (
        latitude === null ||
        longitude === null ||
        !this.hasValidCoordinates(latitude, longitude)
      ) {
        unlocatedVisitors++;
        return;
      }

      const latitudeBucket = Math.round(latitude / 4);
      const longitudeBucket = Math.round(longitude / 4);
      const countryCode = visitor.geo.countryCode?.trim().toUpperCase() || 'XX';
      const key = `${countryCode}:${latitudeBucket}:${longitudeBucket}`;
      const existingGroup = groups.get(key);

      if (existingGroup) {
        existingGroup.latitudeTotal += latitude;
        existingGroup.longitudeTotal += longitude;
        existingGroup.count++;
        return;
      }

      groups.set(key, {
        latitudeTotal: latitude,
        longitudeTotal: longitude,
        count: 1,
        city: visitor.geo.city?.trim() || '',
        country: visitor.geo.country?.trim() || countryCode
      });
    });

    this.markers = Array.from(groups.entries())
      .map(([id, group]) => {
        const latitude = group.latitudeTotal / group.count;
        const longitude = group.longitudeTotal / group.count;
        const location = [group.city, group.country]
          .filter((part, index, values) => Boolean(part) && values.indexOf(part) === index)
          .join(', ');
        const personLabel = group.count === 1 ? 'pessoa online' : 'pessoas online';

        return {
          id,
          x: this.projectLongitude(longitude),
          y: this.projectLatitude(latitude),
          radius: Math.min(18, 7 + (Math.log2(group.count) * 2.5)),
          count: group.count,
          label: `${group.count} ${personLabel} em ${location || 'localização aproximada'}`
        };
      })
      .sort((a, b) => b.count - a.count);

    this.mappedVisitorsCount = this.markers.reduce((total, marker) => total + marker.count, 0);
    this.unlocatedVisitorsCount = unlocatedVisitors;
    this.mapAriaLabel = this.mappedVisitorsCount
      ? `Mapa mundial com ${this.mappedVisitorsCount} ${this.mappedVisitorsCount === 1 ? 'visitante online localizado' : 'visitantes online localizados'} em ${this.markers.length} ${this.markers.length === 1 ? 'região' : 'regiões'}.`
      : 'Mapa mundial sem visitantes online localizados.';
  }

  private hasValidCoordinates(
    latitude: number,
    longitude: number
  ): boolean {
    return Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      longitude >= -180 &&
      longitude <= 180;
  }

  private projectLongitude(longitude: number): number {
    const projected = ((longitude + 180) / 360) * this.viewBoxWidth;
    return this.clamp(projected, 10, this.viewBoxWidth - 10);
  }

  private projectLatitude(latitude: number): number {
    const projected = ((90 - latitude) / 180) * this.viewBoxHeight;
    return this.clamp(projected, 10, this.viewBoxHeight - 10);
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, value));
  }
}
