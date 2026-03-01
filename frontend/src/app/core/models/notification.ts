// src/app/core/models/notification.ts
export interface Notification {
  notificationId: string;
  type: 'LOW_STOCK' | 'OUT_OF_STOCK' | 'REORDER_NEEDED' | 'STOCK_UPDATE';
  message: string;
  packName?: string;
  currentStock?: number;
  isRead: boolean;
  createdAt: string;
}
