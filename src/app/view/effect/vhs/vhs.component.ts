import { Component } from '@angular/core';

@Component({
  selector: 'app-vhs',
  templateUrl: './vhs.component.html',
  styleUrls: ['./vhs.component.css']
})
export class VhsComponent {
  showIntro = true;

  ngOnInit() {
    this.playCassetteSound();
    setTimeout(() => {
      this.showIntro = false;
    }, 4000); 
  }

  playCassetteSound() {
    const audio = new Audio('assets/sound/turningOn.mp3');
    audio.volume = 0.1;
    audio.play().catch(err => console.warn('Som bloqueado por autoplay:', err));
  }
}
