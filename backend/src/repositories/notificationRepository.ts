import { query } from '../config/database';
import type { NotificationRow, PushSubscriptionRow } from '../models/Notification';

export class NotificationRepository {
  static async createFromAlerts(): Promise<NotificationRow[]> {
    const sql = `
      WITH matches AS (
        SELECT DISTINCT fr.user_id, a.id AS alert_id
        FROM service_alerts a
        JOIN favorite_routes fr ON a.route_ids && ARRAY[fr.route_id::text]
        UNION
        SELECT DISTINCT fs.user_id, a.id AS alert_id
        FROM service_alerts a
        JOIN favorite_stops fs ON a.stop_ids && ARRAY[fs.stop_id::text]
      ),
      inserted AS (
        INSERT INTO notifications (user_id, alert_id, title, body, effect_text)
        SELECT
          m.user_id,
          m.alert_id,
          COALESCE(a.header_text, 'Service Alert'),
          COALESCE(a.description_text, ''),
          a.effect_text
        FROM matches m
        JOIN service_alerts a ON a.id = m.alert_id
        ON CONFLICT (user_id, alert_id) DO NOTHING
        RETURNING *
      )
      SELECT * FROM inserted
      ORDER BY created_at DESC
    `;
    const result = await query<NotificationRow>(sql);
    return result.rows;
  }

  static async listByUser(userId: number, onlyUnread = false): Promise<NotificationRow[]> {
    const sql = `
      SELECT *
      FROM notifications
      WHERE user_id = $1
        AND ($2::boolean = false OR is_read = false)
      ORDER BY created_at DESC
      LIMIT 200
    `;
    const result = await query<NotificationRow>(sql, [userId, onlyUnread]);
    return result.rows;
  }

  static async markRead(userId: number, notificationId: number): Promise<void> {
    const sql = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND id = $2
    `;
    await query(sql, [userId, notificationId]);
  }

  static async markAllRead(userId: number): Promise<void> {
    const sql = `
      UPDATE notifications
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
    `;
    await query(sql, [userId]);
  }

  static async markEmailSent(notificationIds: number[]): Promise<void> {
    if (notificationIds.length === 0) return;
    const sql = `
      UPDATE notifications
      SET email_sent = true
      WHERE id = ANY($1::int[])
    `;
    await query(sql, [notificationIds]);
  }

  static async listUnsentEmail(limit = 200): Promise<NotificationRow[]> {
    const sql = `
      SELECT *
      FROM notifications
      WHERE email_sent = false
      ORDER BY created_at ASC
      LIMIT $1
    `;
    const result = await query<NotificationRow>(sql, [limit]);
    return result.rows;
  }

  static async markWebPushSent(notificationIds: number[]): Promise<void> {
    if (notificationIds.length === 0) return;
    const sql = `
      UPDATE notifications
      SET webpush_sent = true
      WHERE id = ANY($1::int[])
    `;
    await query(sql, [notificationIds]);
  }

  static async upsertPushSubscription(sub: PushSubscriptionRow): Promise<void> {
    const sql = `
      INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (endpoint)
      DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `;
    await query(sql, [sub.user_id, sub.endpoint, sub.p256dh, sub.auth]);
  }

  static async listPushSubscriptionsByUser(userId: number): Promise<PushSubscriptionRow[]> {
    const sql = `
      SELECT id, user_id, endpoint, p256dh, auth, created_at
      FROM push_subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await query<PushSubscriptionRow>(sql, [userId]);
    return result.rows;
  }

  static async removePushSubscription(userId: number, endpoint: string): Promise<void> {
    const sql = 'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2';
    await query(sql, [userId, endpoint]);
  }
}
