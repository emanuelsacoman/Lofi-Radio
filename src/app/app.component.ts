import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'lofi';

  showIntro = true;

  onIntroFinished() {
    this.showIntro = false;
  }
}
