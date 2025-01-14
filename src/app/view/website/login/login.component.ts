import { Component } from '@angular/core';
import { FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';
import { Meta, Title } from '@angular/platform-browser';
import { Router } from '@angular/router';
import { NgToastService } from 'ng-angular-popup';
import { AuthService } from 'src/app/services/auth.service';
import { User } from 'src/app/services/interfaces/user';
import { ToastService } from 'src/app/services/toast.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  userForm!: FormGroup;
  loginError: string | null = null;

  title = 'Lofi Radio | Login';
  description = 'Login Page.';
  
  constructor(private router: Router,
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private titleService: Title,
    private metaService: Meta,
    private toast: NgToastService,
    private toastService: ToastService) {
      this.setDocTitle(this.title);
      this.setMetaDescription(this.description);
  }
  ngOnInit(): void {
    this.userForm = new FormGroup({
      senha: new FormControl('', [Validators.required]),
      email: new FormControl('', [Validators.email]),
    });
  }

  submit() {
    if (this.userForm.invalid) {
      this.toastService.warning("Atenção", "Preencha todos os campos corretamente.");
      return;
    }

    const user: User = this.userForm.value;

    this.authService.login(user).then(() => {
      this.router.navigate(['']);
      this.toastService.success("Sucesso!", "Login Efetuado com Sucesso.");
    }).catch((error: any) => {
      this.loginError = error.message || 'Email ou senha incorretos.';
      this.toastService.error("Erro!", this.loginError!);
      this.userForm.reset();
    });
  }

  isInvalidControl(controlName: string) {
    const control = this.userForm.get(controlName);
    return control && control.invalid && (control.dirty || control.touched);
  }

  setDocTitle(title: string) {
    console.log('current title:::::' + this.titleService.getTitle());
    this.titleService.setTitle(title);
 }

  setMetaDescription(description: string) {
    console.log('Updating meta description:::::', description);
    this.metaService.updateTag({ name: 'description', content: description });
  }
}
