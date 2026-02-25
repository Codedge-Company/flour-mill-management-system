// src/app/features/user-management/user-management.component.ts
import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { UserService, UserResponse, CreateUserDto } from '../../core/services/user.service';
import { RoleCountPipe } from './role-count.pipe';

@Component({
    selector: 'app-user-management',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RoleCountPipe],
    templateUrl: './user-management.component.html',
    styleUrl: './user-management.component.css'
})
export class UserManagementComponent implements OnInit {
    users = signal<UserResponse[]>([]);
    loading = signal(false);
    formLoading = signal(false);
    error = signal<string | null>(null);
    successMessage = signal<string | null>(null);

    // Form mode: null = hidden, 'create' | 'edit'
    formMode = signal<'create' | 'edit' | null>(null);
    editingUser = signal<UserResponse | null>(null);

    deletingId = signal<string | null>(null);
    confirmDeleteId = signal<string | null>(null);

    createForm: FormGroup;

    constructor(
        private userService: UserService,
        private fb: FormBuilder
    ) {
        this.createForm = this.fb.group({
            full_name: ['', [Validators.required, Validators.minLength(2)]],
            username: ['', [Validators.required, Validators.minLength(3)]],
            password: ['', [Validators.minLength(6)]],
            role: ['SALES', Validators.required]
        });
    }

    ngOnInit(): void {
        this.loadUsers();
    }

    // ── Load ─────────────────────────────────────────────────────────────────

    loadUsers(): void {
        this.loading.set(true);
        this.error.set(null);
        this.userService.getAllUsers().subscribe({
            next: (users) => {
                this.users.set(users);
                this.loading.set(false);
            },
            error: (err) => {
                this.error.set(err.message);
                this.loading.set(false);
            }
        });
    }

    // ── Create ───────────────────────────────────────────────────────────────

    openCreateForm(): void {
        this.editingUser.set(null);
        this.createForm.reset({ role: 'SALES' });
        // Password required for create
        this.createForm.get('password')!.setValidators([Validators.required, Validators.minLength(6)]);
        this.createForm.get('password')!.updateValueAndValidity();
        this.formMode.set('create');
        this.error.set(null);
    }

    // ── Edit ─────────────────────────────────────────────────────────────────

    openEditForm(user: UserResponse): void {
        this.editingUser.set(user);
        this.createForm.patchValue({
            full_name: user.full_name,
            username: user.username,
            password: '',
            role: user.role
        });
        // Password optional for edit
        this.createForm.get('password')!.setValidators([Validators.minLength(6)]);
        this.createForm.get('password')!.updateValueAndValidity();
        this.formMode.set('edit');
        this.error.set(null);
    }

    // ── Close ────────────────────────────────────────────────────────────────

    closeForm(): void {
        this.formMode.set(null);
        this.editingUser.set(null);
        this.createForm.reset({ role: 'SALES' });
        this.error.set(null);
    }

    // ── Submit ───────────────────────────────────────────────────────────────

    onSubmit(): void {
        if (this.createForm.invalid) {
            this.createForm.markAllAsTouched();
            return;
        }
        if (this.formMode() === 'edit') {
            this.submitEdit();
        } else {
            this.submitCreate();
        }
    }

    private submitCreate(): void {
        this.formLoading.set(true);
        this.error.set(null);
        const dto: CreateUserDto = this.createForm.value;
        this.userService.createUser(dto).subscribe({
            next: (user) => {
                this.users.update(list => [user, ...list]);
                this.formLoading.set(false);
                this.closeForm();
                this.showSuccess(`User "${user.full_name}" created successfully.`);
            },
            error: (err) => {
                this.error.set(err.message);
                this.formLoading.set(false);
            }
        });
    }

    private submitEdit(): void {
        this.formLoading.set(true);
        this.error.set(null);
        const id = this.editingUser()!.id;
        const raw = this.createForm.value;
        // Only send password if the user typed a new one
        const dto: any = {
            full_name: raw.full_name,
            username: raw.username,
            role: raw.role,
            ...(raw.password ? { password: raw.password } : {})
        };
        this.userService.updateUser(id, dto).subscribe({
            next: (updated) => {
                this.users.update(list => list.map(u => u.id === id ? updated : u));
                this.formLoading.set(false);
                this.closeForm();
                this.showSuccess(`User "${updated.full_name}" updated successfully.`);
            },
            error: (err) => {
                this.error.set(err.message);
                this.formLoading.set(false);
            }
        });
    }

    // ── Delete ───────────────────────────────────────────────────────────────

    requestDelete(id: string): void {
        this.confirmDeleteId.set(id);
    }

    cancelDelete(): void {
        this.confirmDeleteId.set(null);
    }

    confirmDelete(id: string): void {
        this.deletingId.set(id);
        this.confirmDeleteId.set(null);
        this.userService.deleteUser(id).subscribe({
            next: () => {
                const deleted = this.users().find(u => u.id === id);
                this.users.update(list => list.filter(u => u.id !== id));
                this.deletingId.set(null);
                this.showSuccess(`User "${deleted?.full_name ?? ''}" deleted.`);
            },
            error: (err) => {
                this.error.set(err.message);
                this.deletingId.set(null);
            }
        });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private showSuccess(msg: string): void {
        this.successMessage.set(msg);
        setTimeout(() => this.successMessage.set(null), 3500);
    }

    getInitials(name: string): string {
        return name.split(' ').slice(0, 2).map(n => n.charAt(0).toUpperCase()).join('');
    }

    formatDate(dateStr: string): string {
        return new Date(dateStr).toLocaleDateString('en-US', {
            year: 'numeric', month: 'short', day: 'numeric'
        });
    }

    isFieldInvalid(field: string): boolean {
        const control = this.createForm.get(field);
        return !!(control?.invalid && control.touched);
    }

    get isEditMode(): boolean {
        return this.formMode() === 'edit';
    }

    get formTitle(): string {
        return this.isEditMode
            ? `Edit — ${this.editingUser()?.full_name}`
            : 'Create New User';
    }
}