import { NgModule } from '@angular/core';
import { BrowserModule, Title } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './view/website/home/home.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { YouTubePlayerModule } from '@angular/youtube-player';
import { MatSliderModule } from '@angular/material/slider';
import { FIREBASE_OPTIONS } from '@angular/fire/compat';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { createClient } from 'pexels';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { environment } from 'src/environments/environment';
import { AngularFireDatabaseModule } from '@angular/fire/compat/database';
import {MatExpansionModule} from '@angular/material/expansion';
import { LoginComponent } from './view/website/login/login.component';
import { NgToastModule } from 'ng-angular-popup';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { getFirestore, provideFirestore } from '@angular/fire/firestore';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { AdmComponent } from './view/adm/adm/adm.component';
import { HttpClientModule } from '@angular/common/http';
import { MatListModule } from '@angular/material/list';

const client = createClient(environment.apikey);


@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    LoginComponent,
    AdmComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatIconModule,
    MatTooltipModule,
    YouTubePlayerModule,
    MatSliderModule,
    MatProgressSpinnerModule,
    FormsModule,
    AngularFireDatabaseModule,
    MatExpansionModule,
    NgToastModule,
    ReactiveFormsModule,
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => getFirestore()),
    provideAuth(() => getAuth()),
    HttpClientModule,
    MatListModule
  ],
  providers: [Title,
    { provide: FIREBASE_OPTIONS, useValue: environment.firebase }],
  bootstrap: [AppComponent]
})
export class AppModule { }
