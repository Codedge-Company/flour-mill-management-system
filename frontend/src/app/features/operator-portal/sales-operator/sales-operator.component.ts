import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { Router } from '@angular/router';

@Component({
    selector: 'app-sales-operator',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './sales-operator.component.html',
    styleUrl: './sales-operator.component.css'
})
export class SalesOperatorComponent {
    constructor(
        public authService: AuthService,
        private router: Router
    ) {}

    logout(): void {
        this.authService.logout();
        this.router.navigateByUrl('/portal/sales-operator');
    }
}
