import { databaseClient } from "../config/database.js";
import { NotificationType, NotificationStatus } from "../generated/prisma/enums.js";

const prisma = databaseClient.getClient();

export interface CreateNotificationDto {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
  organizationContext?: string;
  relatedResource?: {
    type: string;
    id: string;
  };
}

export class NotificationService {
  async createNotification(dto: CreateNotificationDto) {
    // Keep message concise and avoid exposing medical details
    const payload = {
      title: dto.title,
      message: dto.message,
      actionUrl: dto.actionUrl,
      organizationContext: dto.organizationContext,
      relatedResource: dto.relatedResource,
    };

    return prisma.$transaction(async (txn) => {
      const notification = await txn.notification.create({
        data: {
          userId: dto.userId,
          type: dto.type,
          status: NotificationStatus.PENDING,
          payload,
        },
      });

      await txn.outboxEvent.create({
        data: {
          topic: 'NOTIFICATION',
          payload: { notificationId: notification.id }
        }
      });

      return notification;
    });
  }

  async getNotifications(userId: string, page: number = 1, pageSize: number = 20) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      prisma.notification.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      prisma.notification.count({ where: { userId } }),
    ]);

    return {
      items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getUnreadCount(userId: string) {
    return prisma.notification.count({
      where: {
        userId,
        readAt: null,
      },
    });
  }

  async markAsRead(userId: string, notificationId: string) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      throw new Error("Notification not found");
    }

    if (notification.userId !== userId) {
      throw new Error("Unauthorized to access this notification");
    }

    return prisma.notification.update({
      where: { id: notificationId },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });
  }

  async markAllAsRead(userId: string) {
    return prisma.notification.updateMany({
      where: {
        userId,
        readAt: null,
      },
      data: {
        readAt: new Date(),
        status: NotificationStatus.READ,
      },
    });
  }
}

export const notificationService = new NotificationService();
