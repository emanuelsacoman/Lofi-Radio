import { Component } from '@angular/core';
import { VisualizerService } from 'src/app/services/visualizer.service';

@Component({
  selector: 'app-visualizer',
  templateUrl: './visualizer.component.html',
  styleUrls: ['./visualizer.component.css'],
})
export class VisualizerComponent {
  
  constructor(private visualizerService: VisualizerService) {}

  
}
