// src/app/features/notifications/notifications.routes.ts
import { Routes } from '@angular/router';

export const notificationsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./notification-list/notification-list.component').then(m => m.NotificationListComponent)
  }
];