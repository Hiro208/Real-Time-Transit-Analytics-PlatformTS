import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { NotificationRepository } from '../repositories/notificationRepository';
import { UserRepository } from '../repositories/userRepository';
import type { NotificationRow } from '../models/Notification';

function getMailer() {
  if (!env.SMTP_HOST || !env.SMTP_PORT || !env.SMTP_USER || !env.SMTP_PASS) return null;
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_PORT === 465,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASS,
    },
  });
}

function sanitizeMailHeader(value: string): string {
  // SMTP headers (e.g. Subject) cannot contain CR/LF.
  return value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export class NotificationDispatchService {
  static async dispatchNewNotifications(notifications: NotificationRow[]): Promise<void> {
    if (notifications.length === 0) return;

    const byUser = new Map<number, NotificationRow[]>();
    for (const n of notifications) {
      if (!byUser.has(n.user_id)) byUser.set(n.user_id, []);
      byUser.get(n.user_id)!.push(n);
    }

    const mailer = getMailer();

    for (const [userId, userNotifications] of byUser.entries()) {
      const settings = await UserRepository.getNotificationSettings(userId);
      if (!settings) continue;

      // Email
      if (settings.email_notifications_enabled && mailer && env.SMTP_FROM) {
        const user = await UserRepository.findById(userId);
        if (user?.email) {
          const sentIds: number[] = [];
          let shouldStopCurrentBatch = false;
          for (const n of userNotifications) {
            if (shouldStopCurrentBatch) break;
            try {
              const safeTitle = sanitizeMailHeader(n.title || 'Service Alert');
              await mailer.sendMail({
                from: env.SMTP_FROM,
                to: user.email,
                subject: `[MTA Alert] ${safeTitle}`,
                text: `${n.title}\n\n${n.body || ''}\n\nEffect: ${n.effect_text || 'N/A'}`,
              });
              sentIds.push(n.id);
            } catch (e: any) {
              const message = e?.message || 'unknown error';
              console.error(`❌ 邮件发送失败 notification#${n.id} -> ${user.email}: ${message}`);
              if (/too many login attempts|454-4\.7\.0/i.test(message)) {
                // Gmail auth is rate-limited; stop this batch and let next cron retry.
                shouldStopCurrentBatch = true;
              }
            }
          }
          await NotificationRepository.markEmailSent(sentIds);
        }
      }
    }
  }
}
