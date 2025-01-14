import { Injectable } from '@angular/core';
import { NgToastService } from 'ng-angular-popup';

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  constructor(private toast: NgToastService) {}

  success(detail: string, summary: string = '', duration: number = 5000): void {
    this.toast.success({ detail, summary, duration });
  }

  error(detail: string, summary: string = '', duration: number = 5000): void {
    this.toast.error({ detail, summary, duration });
  }

  warning(detail: string, summary: string = '', duration: number = 5000): void {
    this.toast.warning({ detail, summary, duration });
  }

  info(detail: string, summary: string = '', duration: number = 5000): void {
    this.toast.info({ detail, summary, duration });
  }
}
