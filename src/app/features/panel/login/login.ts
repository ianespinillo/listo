import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { safeReturnUrl } from '../../../core/panel-auth.guard';
import { PanelApiService, parseApiError } from '../../../core/panel-api.service';
import { PublicApiService } from '../../../core/public-api.service';
import { Logo } from '../../../shared/logo/logo';

const INVALID_CREDENTIALS = 'Email o contraseña incorrectos';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login implements OnInit {
  private readonly api = inject(PanelApiService);
  private readonly publicApi = inject(PublicApiService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly document = inject(DOCUMENT);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly form = this.fb.group({
    email: ['', Validators.required],
    password: ['', Validators.required],
  });

  protected readonly schoolName = signal('');
  protected readonly sending = signal(false);
  /** Mensaje del servidor (credenciales, demasiados intentos, sin conexión). */
  protected readonly formError = signal('');

  ngOnInit(): void {
    // Solo decora el panel lateral: si falla, no pasa nada.
    firstValueFrom(this.publicApi.getStatus())
      .then((status) => this.schoolName.set(status.school.name))
      .catch(() => undefined);
  }

  protected showRequired(name: 'email' | 'password'): boolean {
    const control = this.form.controls[name];
    return control.touched && control.invalid;
  }

  protected async submit(): Promise<void> {
    if (this.sending()) return;
    this.formError.set('');
    this.form.markAllAsTouched();
    if (this.form.invalid) {
      this.focus(this.form.controls.email.invalid ? 'l-email' : 'l-pass');
      return;
    }

    this.sending.set(true);
    const { email, password } = this.form.getRawValue();
    try {
      await firstValueFrom(this.api.login(email.trim(), password));
    } catch (err) {
      this.sending.set(false);
      const error = parseApiError(err);
      this.formError.set(error.status === 401 ? INVALID_CREDENTIALS : error.message);
      if (error.status === 401) {
        this.form.controls.password.reset('');
        this.focus('l-pass');
      }
      return;
    }
    this.sending.set(false);
    const returnUrl = safeReturnUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
    await this.router.navigateByUrl(returnUrl ?? '/panel');
  }

  private focus(id: string): void {
    this.document.getElementById(id)?.focus();
  }
}
