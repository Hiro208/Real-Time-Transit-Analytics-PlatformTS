// src/api/transitApi.ts
import axios from 'axios';
import type {
  FavoriteRoute,
  FavoriteStop,
  NotificationItem,
  NotificationSettings,
  ServiceAlert,
  User,
  Vehicle,
  VehicleInsights,
} from '../types/transit';

// 如果你的后端端口是 5001，请保持这个地址
const API_BASE_URL = 'http://localhost:5001/api';
const TOKEN_KEY = 'transit_auth_token';

const api = axios.create({
  baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const getStoredToken = () => localStorage.getItem(TOKEN_KEY);
export const setStoredToken = (token: string) => localStorage.setItem(TOKEN_KEY, token);
export const clearStoredToken = () => localStorage.removeItem(TOKEN_KEY);

export const fetchVehicles = async (): Promise<Vehicle[]> => {
  try {
    const response = await api.get<{ success: boolean; data: Vehicle[] }>(
      `/vehicles`
    );
    return response.data.data;
  } catch (error) {
    console.error('Failed to fetch vehicles:', error);
    return []; // 出错时返回空数组，防止页面崩溃
  }
};

export const fetchVehicleInsights = async (params: {
  range: '15m' | '1h' | '6h' | '24h';
  compare: 'none' | 'previous';
  route: string;
}): Promise<VehicleInsights> => {
  const response = await api.get<{ success: boolean; data: VehicleInsights }>('/vehicles/insights', {
    params,
  });
  return response.data.data;
};

export const fetchStopCoords = async (
  stopId: string
): Promise<{ stop_id: string; stop_name: string; lat: number; lon: number } | null> => {
  try {
    const response = await api.get<{
      success: boolean;
      data: { stop_id: string; stop_name: string; lat: number; lon: number };
    }>(`/vehicles/stops/${encodeURIComponent(stopId)}`);
    return response.data.data;
  } catch {
    return null;
  }
};

export const register = async (email: string, password: string): Promise<{ token: string; user: User }> => {
  const response = await api.post<{ success: boolean; token: string; user: User }>(
    '/auth/register',
    { email, password }
  );
  return { token: response.data.token, user: response.data.user };
};

export const login = async (email: string, password: string): Promise<{ token: string; user: User }> => {
  const response = await api.post<{ success: boolean; token: string; user: User }>(
    '/auth/login',
    { email, password }
  );
  return { token: response.data.token, user: response.data.user };
};

export const fetchMe = async (): Promise<User | null> => {
  try {
    const response = await api.get<{ success: boolean; user: User }>('/auth/me');
    return response.data.user;
  } catch (e) {
    return null;
  }
};

export const fetchFavorites = async (): Promise<{ routes: FavoriteRoute[]; stops: FavoriteStop[] }> => {
  const response = await api.get<{ success: boolean; data: { routes: FavoriteRoute[]; stops: FavoriteStop[] } }>(
    '/favorites'
  );
  return response.data.data;
};

export const addFavoriteRoute = async (routeId: string): Promise<void> => {
  await api.post('/favorites/routes', { route_id: routeId });
};

export const removeFavoriteRoute = async (routeId: string): Promise<void> => {
  await api.delete(`/favorites/routes/${encodeURIComponent(routeId)}`);
};

export const addFavoriteStop = async (stopId: string, stopName: string): Promise<void> => {
  await api.post('/favorites/stops', { stop_id: stopId, stop_name: stopName });
};

export const removeFavoriteStop = async (stopId: string): Promise<void> => {
  await api.delete(`/favorites/stops/${encodeURIComponent(stopId)}`);
};

export const fetchMyNotifications = async (): Promise<ServiceAlert[]> => {
  const response = await api.get<{ success: boolean; data: ServiceAlert[] }>('/alerts/notifications/me');
  return response.data.data || [];
};

export const fetchNotificationCenter = async (onlyUnread = false): Promise<NotificationItem[]> => {
  const response = await api.get<{ success: boolean; data: NotificationItem[] }>(
    `/notifications${onlyUnread ? '?unread=1' : ''}`
  );
  return response.data.data || [];
};

export const markNotificationRead = async (id: number): Promise<void> => {
  await api.patch(`/notifications/${id}/read`);
};

export const markAllNotificationsRead = async (): Promise<void> => {
  await api.patch('/notifications/read-all');
};

export const fetchNotificationSettings = async (): Promise<NotificationSettings | null> => {
  const response = await api.get<{ success: boolean; data: NotificationSettings | null }>('/notifications/settings');
  return response.data.data;
};

export const updateNotificationSettings = async (settings: Partial<NotificationSettings>): Promise<NotificationSettings | null> => {
  const response = await api.patch<{ success: boolean; data: NotificationSettings | null }>(
    '/notifications/settings',
    settings
  );
  return response.data.data;
};
