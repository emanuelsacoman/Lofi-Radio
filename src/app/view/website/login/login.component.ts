import { Component, OnInit } from '@angular/core';
import { FormControl, FormGroup, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';

import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/services/interfaces/user';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent implements OnInit {
  userForm!: FormGroup;
  loginError: string | null = null;
  isSubmitting = false;
  showPassword = false;

  readonly title = 'Lofi Radio | Login';
  readonly description = 'Acesso ao painel administrativo da Lofi Radio.';

  constructor(
    private router: Router,
    private authService: AuthService,
    private titleService: Title,
    private metaService: Meta,
    private toastService: ToastService
  ) {
    this.setDocTitle(this.title);
    this.setMetaDescription(this.description);
  }

  ngOnInit(): void {
    this.userForm = new FormGroup({
      email: new FormControl('', [Validators.required, Validators.email]),
      senha: new FormControl('', [Validators.required])
    });
  }

  submit(): void {
    if (this.isSubmitting) {
      return;
    }

    if (this.userForm.invalid) {
      this.userForm.markAllAsTouched();
      this.toastService.warning('Atencao', 'Preencha os campos corretamente.');
      return;
    }

    const user: User = {
      email: this.userForm.value.email.trim(),
      senha: this.userForm.value.senha
    };

    this.isSubmitting = true;
    this.loginError = null;

    this.authService.login(user)
      .then(() => {
        this.router.navigate(['']);
        this.toastService.success('Sucesso!', 'Login realizado.');
      })
      .catch((error: unknown) => {
        this.loginError = this.getLoginErrorMessage(error);
        this.toastService.error('Nao foi possivel entrar', this.loginError);
      })
      .finally(() => {
        this.isSubmitting = false;
      });
  }

  isInvalidControl(controlName: string): boolean {
    const control = this.userForm.get(controlName);
    return Boolean(control && control.invalid && (control.dirty || control.touched));
  }

  togglePasswordVisibility(): void {
    this.showPassword = !this.showPassword;
  }

  clearLoginError(): void {
    this.loginError = null;
  }

  goHome(): void {
    this.router.navigate(['']);
  }

  private setDocTitle(title: string): void {
    this.titleService.setTitle(title);
  }

  private setMetaDescription(description: string): void {
    this.metaService.updateTag({ name: 'description', content: description });
  }

  private getLoginErrorMessage(error: unknown): string {
    const code = typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code)
      : '';

    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'E-mail ou senha incorretos.';
      case 'auth/too-many-requests':
        return 'Muitas tentativas. Aguarde alguns minutos e tente novamente.';
      case 'auth/network-request-failed':
        return 'Sem conexao com o servidor. Verifique sua internet.';
      default:
        return 'Nao foi possivel acessar o painel. Tente novamente.';
    }
  }
}
