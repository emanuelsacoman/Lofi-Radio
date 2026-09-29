import { ComponentFixture, fakeAsync, flushMicrotasks, TestBed } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { MatIconModule } from '@angular/material/icon';
import { RouterTestingModule } from '@angular/router/testing';
import { NgToastService } from 'ng-angular-popup';

import { AuthService } from 'src/app/services/auth.service';
import { ToastService } from 'src/app/services/toast.service';
import { LoginComponent } from './login.component';

describe('LoginComponent', () => {
  let component: LoginComponent;
  let fixture: ComponentFixture<LoginComponent>;
  let authService: jasmine.SpyObj<AuthService>;
  let toastService: jasmine.SpyObj<ToastService>;

  beforeEach(() => {
    authService = jasmine.createSpyObj<AuthService>('AuthService', ['login']);
    const toast = jasmine.createSpyObj<NgToastService>('NgToastService', [
      'success',
      'error',
      'warning',
      'info'
    ]);
    toastService = jasmine.createSpyObj<ToastService>('ToastService', [
      'success',
      'error',
      'warning',
      'info'
    ]);

    TestBed.configureTestingModule({
      imports: [ReactiveFormsModule, RouterTestingModule, MatIconModule],
      declarations: [LoginComponent],
      providers: [
        { provide: AuthService, useValue: authService },
        { provide: NgToastService, useValue: toast },
        { provide: ToastService, useValue: toastService }
      ]
    });
    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('requires both credentials and exposes the field errors on submit', () => {
    component.submit();

    expect(component.userForm.invalid).toBeTrue();
    expect(component.isInvalidControl('email')).toBeTrue();
    expect(component.isInvalidControl('senha')).toBeTrue();
    expect(authService.login).not.toHaveBeenCalled();
    expect(toastService.warning).toHaveBeenCalled();
  });

  it('prevents duplicate submits while authentication is pending', () => {
    authService.login.and.returnValue(new Promise(() => undefined));
    component.userForm.setValue({
      email: 'admin@lofi.test',
      senha: 'secret'
    });

    component.submit();
    component.submit();

    expect(component.isSubmitting).toBeTrue();
    expect(authService.login).toHaveBeenCalledOnceWith({
      email: 'admin@lofi.test',
      senha: 'secret'
    });
  });

  it('shows a friendly message for invalid credentials', fakeAsync(() => {
    authService.login.and.rejectWith({ code: 'auth/invalid-credential' });
    component.userForm.setValue({
      email: 'admin@lofi.test',
      senha: 'wrong-password'
    });

    component.submit();
    flushMicrotasks();

    expect(component.loginError).toBe('E-mail ou senha incorretos.');
    expect(component.isSubmitting).toBeFalse();
    expect(toastService.error).toHaveBeenCalledWith(
      'Nao foi possivel entrar',
      'E-mail ou senha incorretos.'
    );
  }));
});
