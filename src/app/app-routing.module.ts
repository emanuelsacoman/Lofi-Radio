import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './view/website/home/home.component';
import { LoginComponent } from './view/website/login/login.component';
import { AdmComponent } from './view/adm/adm/adm.component';
import { AuthGuard } from './model/shared/auth.guard';
import { VhsComponent } from './view/effect/vhs/vhs.component';

const routes: Routes = [
  {
    path: '',
    component: HomeComponent
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'adm',
    component: AdmComponent,
    canActivate: [AuthGuard],
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
