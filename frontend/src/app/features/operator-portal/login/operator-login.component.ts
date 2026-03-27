import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { UserResponse } from '../../../core/services/user.service';
import { ROLE_ROUTES } from '../operator.guard';

@Component({
  selector: 'app-operator-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './operator-login.component.html',
  styleUrl: './operator-login.component.css'
})
export class OperatorLoginComponent implements OnInit {
  form: FormGroup;
  loading = signal(false);
  error = signal<string | null>(null);

  // Read from route.data
  private redirectTo!: string;
  private expectedRole!: UserResponse['role'];

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.form = this.fb.group({
      username: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.redirectTo = this.route.snapshot.data['redirectTo'];
    this.expectedRole = this.route.snapshot.data['role'];

    // Already logged in with correct role — skip login
    const role = this.authService.currentUser()?.role;
    if (role === this.expectedRole) {
      this.router.navigateByUrl(this.redirectTo);
    }
  }

  onLogin(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.authService.login(this.form.value).subscribe({
      next: () => {
        this.loading.set(false);
        // Role is stored after login (e.g. in localStorage or a signal)
        const role = this.authService.currentUser()?.role;

        if (role === this.expectedRole) {
          this.router.navigateByUrl(this.redirectTo);
          return;
        }

        this.authService.logout();
        this.error.set(`This login is only for ${this.expectedRole.replace(/_/g, ' ')} users.`);
      },
      error: (err) => {
        this.error.set(err.message);
        this.loading.set(false);
      }
    });
  }
}