import axios from 'axios';
import { AlertRepository, ServiceAlertRow } from '../repositories/alertRepository';
import { NotificationRepository } from '../repositories/notificationRepository';
import { NotificationDispatchService } from './notificationDispatchService';

const ALERT_FEED_URL =
  'https://api-endpoint.mta.info/Dataservice/mtagtfsfeeds/camsys%2Fsubway-alerts.json';

const EFFECT_MAP: Record<number, string> = {
  1: 'NO_SERVICE',
  2: 'REDUCED_SERVICE',
  3: 'SIGNIFICANT_DELAYS',
  4: 'DETOUR',
  5: 'ADDITIONAL_SERVICE',
  6: 'MODIFIED_SERVICE',
  7: 'OTHER_EFFECT',
  8: 'UNKNOWN_EFFECT',
  9: 'STOP_MOVED',
  10: 'NO_EFFECT',
  11: 'ACCESSIBILITY_ISSUE',
};

const CAUSE_MAP: Record<number, string> = {
  1: 'UNKNOWN_CAUSE',
  2: 'OTHER_CAUSE',
  3: 'TECHNICAL_PROBLEM',
  4: 'STRIKE',
  5: 'DEMONSTRATION',
  6: 'ACCIDENT',
  7: 'HOLIDAY',
  8: 'WEATHER',
  9: 'MAINTENANCE',
  10: 'CONSTRUCTION',
  11: 'POLICE_ACTIVITY',
  12: 'MEDICAL_EMERGENCY',
};

export class AlertService {
  static async fetchAndSaveAlerts() {
    try {
      const response = await axios.get(ALERT_FEED_URL, {
        timeout: 10000,
      });

      const feed = response.data as {
        entity?: Array<{
          id?: string;
          alert?: {
            informed_entity?: Array<{
              route_id?: string;
              routeId?: string;
              stop_id?: string;
              stopId?: string;
            }>;
            informedEntity?: Array<{
              route_id?: string;
              routeId?: string;
              stop_id?: string;
              stopId?: string;
            }>;
            header_text?: { translation?: Array<{ text?: string }> };
            description_text?: { translation?: Array<{ text?: string }> };
            headerText?: { translation?: Array<{ text?: string }> };
            descriptionText?: { translation?: Array<{ text?: string }> };
            effect?: number;
            cause?: number;
            'transit_realtime.mercury_alert'?: {
              alert_type?: string;
            };
          };
        }>;
      };

      const parsed: ServiceAlertRow[] = [];
      const now = Math.floor(Date.now() / 1000);

      for (const entity of feed.entity || []) {
        if (!entity.alert || !entity.id) continue;
        const alert = entity.alert;
        const informed = alert.informed_entity || alert.informedEntity || [];

        const routeIds = Array.from(
          new Set(
            informed
              .map((i) => String(i.route_id || i.routeId || '').toUpperCase())
              .filter(Boolean)
          )
        );
        const stopIds = Array.from(
          new Set(
            informed
              .map((i) => String(i.stop_id || i.stopId || '').toUpperCase())
              .filter(Boolean)
          )
        );

        const header =
          alert.header_text?.translation?.[0]?.text || alert.headerText?.translation?.[0]?.text || null;
        const description =
          alert.description_text?.translation?.[0]?.text ||
          alert.descriptionText?.translation?.[0]?.text ||
          null;
        const effect =
          alert['transit_realtime.mercury_alert']?.alert_type ||
          (alert.effect != null ? EFFECT_MAP[Number(alert.effect)] || String(alert.effect) : null);
        const cause = alert.cause != null ? (CAUSE_MAP[Number(alert.cause)] || String(alert.cause)) : null;

        parsed.push({
          id: String(entity.id),
          header_text: header,
          description_text: description,
          effect_text: effect,
          cause_text: cause,
          route_ids: routeIds,
          stop_ids: stopIds,
          updated_at: now,
        });
      }

      await AlertRepository.upsertBatch(parsed);
      const newNotifications = await NotificationRepository.createFromAlerts();
      await NotificationDispatchService.dispatchNewNotifications(newNotifications);
      // Retry a small batch to avoid SMTP provider auth throttling.
      const pendingEmailNotifications = await NotificationRepository.listUnsentEmail(5);
      await NotificationDispatchService.dispatchNewNotifications(pendingEmailNotifications);
      console.log(`🚨 服务告警同步完成，共 ${parsed.length} 条`);
    } catch (e: any) {
      console.error('❌ 服务告警同步失败:', e.message);
    }
  }
}
