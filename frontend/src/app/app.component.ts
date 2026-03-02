// src/app/app.component.ts
import { Component, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/services/auth.service';
import { NotificationService } from './core/services/notification.service';
import { PushNotificationService } from './core/services/push-notification.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  template: `<router-outlet />`
})
export class AppComponent implements OnInit {
  constructor(
    private authService: AuthService,
    private notificationService: NotificationService,
    private pushService: PushNotificationService
  ) {}

  ngOnInit(): void {
    // Page refresh: reconnect socket if session already exists
    if (this.authService.currentUser()) {
      this.notificationService.connect();
      this.pushService.requestPermissionAndSubscribe();
    }
  }
}
