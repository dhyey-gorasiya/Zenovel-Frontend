import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RememberedCredentialsService } from '../../core/auth/remembered-credentials.service';
import { Role } from '../../core/models';
import { ToastService } from '../../core/services/toast.service';
import { Icon } from '../../shared/icons';
import { FormField } from '../../shared/ui/form-field';

const ROLE_ORDER: Role[] = ['Project Manager', 'Monitor', 'HOD/VP', 'Sponsor'];

@Component({
  imports: [ReactiveFormsModule, Icon, FormField],
  changeDetection: ChangeDetectionStrategy.Eager,
  templateUrl: './login.html',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  private readonly remembered = inject(RememberedCredentialsService);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly loading = signal(false);
  protected readonly error = signal('');
  protected readonly showPassword = signal(false);
  protected readonly rememberMe = signal(false);
  private readonly accounts = signal(this.auth.demoAccounts());
  protected readonly demoPassword = computed(() => this.accounts()[0]?.password ?? '');
  protected readonly accountsByRole = computed(() =>
    ROLE_ORDER.map(role => ({ role, accounts: this.accounts().filter(a => a.role === role) })).filter(g => g.accounts.length),
  );

  constructor() {
    void this.restoreRemembered();
  }

  fill(email: string, password: string): void {
    this.form.setValue({ email, password });
    this.error.set('');
  }

  forgotPassword(): void {
    this.toast.info('Password reset is not available in this prototype. Use one of the demo accounts below.');
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid) return;
    const { email, password } = this.form.getRawValue();
    this.loading.set(true);
    this.error.set('');
    this.auth.login(email, password).subscribe({
      next: () => {
        this.loading.set(false);
        if (this.rememberMe()) void this.remembered.save({ email, password });
        else this.remembered.clear();
        const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl');
        this.router.navigateByUrl(returnUrl && returnUrl.startsWith('/') && !returnUrl.startsWith('/login') ? returnUrl : '/dashboard');
      },
      error: (e: Error) => {
        this.loading.set(false);
        this.error.set(e.message);
      },
    });
  }

  private async restoreRemembered(): Promise<void> {
    const saved = await this.remembered.load();
    if (!saved || this.form.dirty) return;
    this.form.setValue(saved);
    this.rememberMe.set(true);
  }
}
