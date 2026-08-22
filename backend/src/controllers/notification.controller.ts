import type { Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { notificationService } from '../services/notification.service.js';

export const getNotifications = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const result = await notificationService.getNotifications(userId, page, pageSize);
    res.json(result);
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getUnreadCount = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const count = await notificationService.getUnreadCount(userId);
    res.json({ unreadCount: count });
  } catch (error) {
    console.error('Error fetching unread count:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const markAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const updated = await notificationService.markAsRead(userId, id as string);
    res.json(updated);
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Needed for test fixtures/types
  } catch (error: any) {
    if (error.message === 'Unauthorized to access this notification') {
      res.status(403).json({ error: error.message });
    } else if (error.message === 'Notification not found') {
      res.status(404).json({ error: error.message });
    } else {
      console.error('Error marking notification as read:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
};

export const markAllAsRead = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    await notificationService.markAllAsRead(userId);
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
