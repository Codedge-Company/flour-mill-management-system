import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { PermissionService } from '../../../core/services/permission.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  form: FormGroup;
  loading  = signal(false);
  error    = signal<string | null>(null);
  showPass = signal(false);
  readonly currentYear = new Date().getFullYear();

  /** the page the user asked for before being sent to login (saved home-screen link, bookmark) */
  private readonly returnUrl: string;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private permissionService: PermissionService,
    private router: Router,
    route: ActivatedRoute
  ) {
    const wanted = route.snapshot.queryParamMap.get('returnUrl') ?? '';
    // only in-app paths, never another site, and never the login page itself
    this.returnUrl = wanted.startsWith('/') && !wanted.startsWith('//') && !wanted.startsWith('/auth') ? wanted : '';

    if (this.authService.isLoggedIn()) {
      this.router.navigateByUrl(this.returnUrl || '/dashboard');
    }

    this.form = this.fb.group({
      username: ['', [Validators.required, Validators.minLength(3)]],
      password: ['', [Validators.required, Validators.minLength(4)]]
    });
  }

  get f() { return this.form.controls; }

  togglePassword(): void { this.showPass.update(v => !v); }

  onSubmit(): void {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    if (this.loading()) return;

    this.error.set(null);
    this.loading.set(true);

    this.authService.login(this.form.value).subscribe({
      next: () => {
        if (this.authService.isAdmin()) {
          this.loading.set(false);
          this.router.navigateByUrl(this.returnUrl || '/dashboard');
          return;
        }

        this.permissionService.ensureLoaded().subscribe({
          next: () => {
            this.loading.set(false);
            const target = this.returnUrl || this.permissionService.getFirstAccessibleRoute() || '/dashboard';
            this.router.navigateByUrl(target);
          },
          error: () => {
            this.loading.set(false);
            this.router.navigateByUrl(this.returnUrl || '/dashboard'); // guard redirects further if not allowed
          }
        });
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.message || 'An unexpected error occurred. Please try again.');
      }
    });
  }
}
