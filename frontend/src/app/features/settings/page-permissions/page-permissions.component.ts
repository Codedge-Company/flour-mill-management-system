import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { PermissionService } from '../../../core/services/permission.service';
import { PageDef, RolePermission } from '../../../core/models/page-permission';

@Component({
  selector: 'app-page-permissions',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule], // ToastModule removed
  templateUrl: './page-permissions.component.html',
  styleUrl: './page-permissions.component.css',
})
export class PagePermissionsComponent implements OnInit {
  readonly roles = ['SALES', 'MACHINE_OPERATOR', 'PACKING_OPERATOR'];
  pages: PageDef[] = [];
  matrix: Record<string, Set<string>> = {};
  loading = true;
  saving = false;

  // Modal state
  modalVisible = false;
  modalType: 'success' | 'error' = 'success';
  modalMessage = '';

  constructor(private permissionService: PermissionService) {}

  ngOnInit() {
    this.permissionService.getAllPages().subscribe(res => {
      this.pages = res.data;
      this.permissionService.getMatrix().subscribe(matrixRes => {
        for (const role of this.roles) {
          const found = matrixRes.data.find((m: RolePermission) => m.role === role);
          this.matrix[role] = new Set(found?.pages ?? []);
        }
        this.loading = false;
      });
    });
  }

  isChecked(role: string, pageKey: string): boolean {
    return this.matrix[role]?.has(pageKey) ?? false;
  }

  toggle(role: string, pageKey: string) {
    const set = this.matrix[role];
    set.has(pageKey) ? set.delete(pageKey) : set.add(pageKey);
  }

  save() {
    this.saving = true;
    const payload: RolePermission[] = this.roles.map(role => ({
      role: role as RolePermission['role'],
      pages: Array.from(this.matrix[role]),
    }));

    this.permissionService.updateMatrix(payload).subscribe({
      next: () => {
        this.saving = false;
        this.showModal('success', 'Permissions updated successfully.');
      },
      error: (err) => {
        this.saving = false;
        this.showModal('error', 'Failed to save permissions. Please try again.');
        console.error(err);
      },
    });
  }

  private showModal(type: 'success' | 'error', message: string) {
    this.modalType = type;
    this.modalMessage = message;
    this.modalVisible = true;
  }

  closeModal() {
    this.modalVisible = false;
  }
}