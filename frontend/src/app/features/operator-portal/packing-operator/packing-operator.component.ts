import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-packing-operator',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './packing-operator.component.html',
    styleUrl: './packing-operator.component.css'
})
export class PackingOperatorComponent {
    constructor(
        public authService: AuthService,
        private router: Router
    ) {}

    logout(): void {
        this.authService.logout();
        this.router.navigateByUrl('/portal/packing-operator');
    }
}
