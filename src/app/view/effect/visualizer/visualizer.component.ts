import { Component } from '@angular/core';
import { VisualizerService } from 'src/app/services/visualizer.service';

@Component({
  selector: 'app-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.css'],
})
export class VisualizerComponent {
  
  constructor(private visualizerService: VisualizerService) {}

  testVisualizer(): void {
    this.visualizerService.setPreset('default-wave');

    this.visualizerService.updateParameters({
      amplitude: 70,
      frequency: 5,
      harmonics: 4,
    });

    const points = this.visualizerService.calculatePoints(2, 100);

    console.log(points);
  }
}
