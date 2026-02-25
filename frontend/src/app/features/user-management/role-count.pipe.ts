// src/app/features/user-management/role-count.pipe.ts
import { Pipe, PipeTransform } from '@angular/core';
import { UserResponse } from '../../core/services/user.service';

@Pipe({ name: 'roleCount', standalone: true })
export class RoleCountPipe implements PipeTransform {
    transform(users: UserResponse[], role: 'ADMIN' | 'SALES'): number {
        return users.filter(u => u.role === role).length;
    }
}