
export type NotificationType = 'LOW_STOCK';

export interface Notification {
  notificationId: number;
  type: NotificationType;
  packTypeId: number | null;
  packName: string | null;
  message: string;
  isRead: boolean;
  createdAt: string;
}