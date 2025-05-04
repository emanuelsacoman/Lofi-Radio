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
    const audio = new Audio('assets/sound/casset.mpeg');
    audio.volume = 0.5;
    audio.play().catch(err => console.warn('Som bloqueado por autoplay:', err));
  }
}
