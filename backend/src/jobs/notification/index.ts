import { databaseClient } from '../../config/database.js';
import type { NotificationJob } from '../types.js';

const prisma = databaseClient.getClient();

export const processNotification = async (data: NotificationJob) => {
  const { notificationId } = data;
  
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId }
  });

  if (!notification) {
    throw new Error('Notification ' + notificationId + ' not found');
  }

  console.log('[Job] Delivered notification ' + notification.id + ' to user ' + notification.userId);
};