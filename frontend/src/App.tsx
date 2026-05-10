// src/App.tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import Map, { Source, Layer, NavigationControl, Popup, GeolocateControl, type MapRef } from 'react-map-gl';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import { useVehicles } from './hooks/useVehicles';
import ControlPanel from './components/ControlPanel';
import VehiclePopup from './components/VehiclePopup';
import { ROUTE_COLORS } from './config/constants';
import type {
  FavoriteStop,
  NotificationItem,
  NotificationSettings,
  User,
  Vehicle,
  VehicleInsights,
} from './types/transit';
import { createTranslator, type Language } from './i18n';
import {
  addFavoriteRoute,
  addFavoriteStop,
  clearStoredToken,
  fetchFavorites,
  fetchMe,
  fetchNotificationCenter,
  fetchNotificationSettings,
  fetchVehicleInsights,
  fetchStopCoords,
  getStoredToken,
  login,
  markAllNotificationsRead,
  markNotificationRead,
  register,
  removeFavoriteRoute,
  removeFavoriteStop,
  setStoredToken,
  updateNotificationSettings,
} from './api/transitApi';

import 'mapbox-gl/dist/mapbox-gl.css';

const queryClient = new QueryClient();
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

const extractStopCode = (stopName?: string): string => {
  if (!stopName) return '';
  const match = stopName.match(/\(([A-Z0-9]+)\)\s*$/i);
  return match ? match[1].toUpperCase() : stopName.trim().toUpperCase();
};

const getVehicleCoords = (vehicle: Vehicle): { lat: number; lng: number } | null => {
  const latRaw = vehicle.lat ?? vehicle.latitude;
  const lngRaw = vehicle.lon ?? vehicle.longitude;
  const lat = Number(latRaw);
  const lng = Number(lngRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return { lat, lng };
};

const extractRouteFromStopId = (stopId: string): string | null => {
  const s = String(stopId || '').toUpperCase();
  if (!s) return null;
  if (s.startsWith('SI')) return 'SI';
  const match = s.match(/^([A-Z]|\d)/);
  return match ? match[1] : null;
};

const vehicleMatchesStopId = (vehicle: Vehicle, stopId: string): boolean => {
  const target = String(stopId || '').toUpperCase();
  if (!target) return false;
  const code = extractStopCode(vehicle.stop_name);
  if (code === target) return true;
  const raw = String(vehicle.stop_name || '').toUpperCase();
  return raw.includes(`(${target})`) || raw.endsWith(target);
};

type PopupInfo = { lng: number; lat: number; props: Vehicle };
type FocusedStopMarker = { lng: number; lat: number; stopId: string; routeId: string };
type TimeRange = '15m' | '1h' | '6h' | '24h';
type CompareMode = 'none' | 'previous';

const TransitMap = () => {
  const mapRef = useRef<MapRef | null>(null);
  const [selectedRoute, setSelectedRoute] = useState('ALL');
  const [hoverInfo, setHoverInfo] = useState<PopupInfo | null>(null);
  const [pinnedInfo, setPinnedInfo] = useState<PopupInfo | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [favoriteRoutes, setFavoriteRoutes] = useState<Set<string>>(new Set());
  const [favoriteStops, setFavoriteStops] = useState<FavoriteStop[]>([]);
  const [favoriteStopSet, setFavoriteStopSet] = useState<Set<string>>(new Set());
  const [focusedStopMarker, setFocusedStopMarker] = useState<FocusedStopMarker | null>(null);
  const [notificationCenter, setNotificationCenter] = useState<NotificationItem[]>([]);
  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings | null>(null);
  const [authError, setAuthError] = useState('');
  const [timeRange, setTimeRange] = useState<TimeRange>('1h');
  const [compareMode, setCompareMode] = useState<CompareMode>('previous');
  const [language, setLanguage] = useState<Language>(() => {
    const saved = localStorage.getItem('ui_language');
    return saved === 'zh' || saved === 'es' || saved === 'en' ? saved : 'en';
  });
  
  const { geoJSON, count, layerColorExpression, vehicles } = useVehicles(selectedRoute);
  const focusedRouteColor = useMemo(
    () => (focusedStopMarker ? ROUTE_COLORS[focusedStopMarker.routeId] || '#86efac' : '#86efac'),
    [focusedStopMarker]
  );
  const t = useMemo(() => createTranslator(language), [language]);
  const routeVehicleCounts = useMemo(() => {
    const all = vehicles as Vehicle[];
    return all.reduce<Record<string, number>>((acc, v) => {
      const route = String(v.route_id || '').toUpperCase();
      if (!route) return acc;
      acc[route] = (acc[route] || 0) + 1;
      return acc;
    }, {});
  }, [vehicles]);
  const routeCountsFallback = useMemo(() => {
    return Object.entries(routeVehicleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([routeId, vehicleCount]) => ({ route_id: routeId, vehicle_count: vehicleCount }));
  }, [routeVehicleCounts]);

  const { data: insights } = useQuery({
    queryKey: ['vehicleInsights', selectedRoute, timeRange, compareMode],
    queryFn: () =>
      fetchVehicleInsights({
        route: selectedRoute,
        range: timeRange,
        compare: compareMode,
      }),
    refetchInterval: 10000,
    staleTime: 5000,
  });

  const trend = useMemo<VehicleInsights>(() => {
    if (insights) {
      return {
        ...insights,
        previous_series: insights.previous_series || [],
      };
    }
    return {
      route: selectedRoute,
      range: timeRange,
      compare: compareMode,
      series: [{ ts: Date.now(), count }],
      previous_series: [],
      current_avg: count,
      previous_avg: null,
      delta: null,
      delta_percent: null,
      top_routes: routeCountsFallback,
    };
  }, [insights, selectedRoute, timeRange, compareMode, count, routeCountsFallback]);

  const unreadCount = useMemo(
    () => notificationCenter.filter((n) => !n.is_read).length,
    [notificationCenter]
  );

  const refreshUserData = async () => {
    if (!getStoredToken()) return;
    const me = await fetchMe();
    if (!me) {
      clearStoredToken();
      setUser(null);
      setFavoriteRoutes(new Set());
      setFavoriteStops([]);
      setFavoriteStopSet(new Set());
      setNotificationCenter([]);
      setNotificationSettings(null);
      return;
    }
    setUser(me);
    const fav = await fetchFavorites();
    setFavoriteRoutes(new Set(fav.routes.map((r) => r.route_id.toUpperCase())));
    setFavoriteStops(fav.stops);
    setFavoriteStopSet(new Set(fav.stops.map((s) => s.stop_id.toUpperCase())));
    setNotificationCenter(await fetchNotificationCenter());
    setNotificationSettings(await fetchNotificationSettings());
  };

  useEffect(() => {
    refreshUserData();
  }, []);

  useEffect(() => {
    localStorage.setItem('ui_language', language);
  }, [language]);

  useEffect(() => {
    if (!user) return;
    const timer = window.setInterval(async () => {
      setNotificationCenter(await fetchNotificationCenter());
    }, 30000);
    return () => window.clearInterval(timer);
  }, [user]);

  useEffect(() => {
    if (!pinnedInfo?.props?.trip_id) return;
    const latestMatch = (vehicles as Vehicle[]).find((v) => v.trip_id === pinnedInfo.props.trip_id);
    if (!latestMatch) return;
    const coords = getVehicleCoords(latestMatch);
    if (!coords) return;
    if (coords.lat === pinnedInfo.lat && coords.lng === pinnedInfo.lng) return;
    setPinnedInfo({
      lng: coords.lng,
      lat: coords.lat,
      props: latestMatch,
    });
    setHoverInfo({
      lng: coords.lng,
      lat: coords.lat,
      props: latestMatch,
    });
  }, [vehicles, pinnedInfo]);

  const handleSubmitAuth = async () => {
    try {
      setAuthError('');
      if (!authForm.email || !authForm.password) return;
      const result = authMode === 'login'
        ? await login(authForm.email, authForm.password)
        : await register(authForm.email, authForm.password);
      setStoredToken(result.token);
      setUser(result.user);
      setAuthForm({ email: '', password: '' });
      await refreshUserData();
    } catch (e) {
      console.error('Auth failed:', e);
      setAuthError(authMode === 'login' ? t('loginFailed') : t('registerFailed'));
    }
  };

  const handleLogout = () => {
    clearStoredToken();
    setUser(null);
    setFavoriteRoutes(new Set());
    setFavoriteStops([]);
    setFavoriteStopSet(new Set());
    setNotificationCenter([]);
    setNotificationSettings(null);
    setAuthError('');
  };

  const handleToggleRouteFavorite = async (routeId: string) => {
    if (!user) return;
    const key = routeId.toUpperCase();
    try {
      if (favoriteRoutes.has(key)) {
        await removeFavoriteRoute(key);
      } else {
        await addFavoriteRoute(key);
      }
      const fav = await fetchFavorites();
      setFavoriteRoutes(new Set(fav.routes.map((r) => r.route_id.toUpperCase())));
      setFavoriteStops(fav.stops);
      setFavoriteStopSet(new Set(fav.stops.map((s) => s.stop_id.toUpperCase())));
      setNotificationCenter(await fetchNotificationCenter());
    } catch (e) {
      console.error('Toggle route favorite failed', e);
    }
  };

  const handleToggleStopFavorite = async (stopDisplayName: string) => {
    if (!user) return;
    const stopId = extractStopCode(stopDisplayName);
    if (!stopId) return;
    const wasFavorited = favoriteStopSet.has(stopId);
    const optimisticSet = new Set(favoriteStopSet);
    if (wasFavorited) optimisticSet.delete(stopId);
    else optimisticSet.add(stopId);
    setFavoriteStopSet(optimisticSet);

    try {
      if (wasFavorited) {
        await removeFavoriteStop(stopId);
      } else {
        await addFavoriteStop(stopId, stopDisplayName);
      }
      const fav = await fetchFavorites();
      setFavoriteRoutes(new Set(fav.routes.map((r) => r.route_id.toUpperCase())));
      setFavoriteStops(fav.stops);
      setFavoriteStopSet(new Set(fav.stops.map((s) => s.stop_id.toUpperCase())));
      setNotificationCenter(await fetchNotificationCenter());
    } catch (e) {
      console.error('Toggle stop favorite failed', e);
      // rollback optimistic update
      setFavoriteStopSet(new Set(favoriteStopSet));
    }
  };

  const handleFocusFavoriteRoute = (routeId: string) => {
    setSelectedRoute(routeId.toUpperCase());
    setPinnedInfo(null);
    setFocusedStopMarker(null);
  };

  const handleFocusFavoriteStop = async (stop: FavoriteStop) => {
    const targetStopId = String(stop.stop_id || '').toUpperCase();
    if (!targetStopId) return;
    const routeHint = extractRouteFromStopId(targetStopId);
    if (routeHint) {
      setSelectedRoute(routeHint);
    }

    const candidates = (vehicles as Vehicle[])
      .filter((v) => vehicleMatchesStopId(v, targetStopId))
      .map((v) => ({ vehicle: v, coords: getVehicleCoords(v) }))
      .filter((item): item is { vehicle: Vehicle; coords: { lat: number; lng: number } } => !!item.coords)
      .sort((a, b) => Number(b.vehicle.timestamp || 0) - Number(a.vehicle.timestamp || 0));

    const best = candidates[0];

    if (!best) {
      const stopCoords = await fetchStopCoords(targetStopId);
      if (!stopCoords) return;
      const syntheticVehicle: Vehicle = {
        trip_id: `STOP-${targetStopId}`,
        route_id: routeHint || 'ALL',
        lat: stopCoords.lat,
        lon: stopCoords.lon,
        direction: 'N',
        destination: stopCoords.stop_name || stop.stop_name || targetStopId,
        stop_name: `${stopCoords.stop_name || stop.stop_name || targetStopId} (${targetStopId})`,
        current_status: 'STOPPED_AT',
        timestamp: Date.now(),
      };
      const syntheticPopup = {
        lng: stopCoords.lon,
        lat: stopCoords.lat,
        props: syntheticVehicle,
      };
      setFocusedStopMarker({
        lng: stopCoords.lon,
        lat: stopCoords.lat,
        stopId: targetStopId,
        routeId: routeHint || 'ALL',
      });
      setPinnedInfo(syntheticPopup);
      setHoverInfo(syntheticPopup);
      mapRef.current?.flyTo({
        center: [syntheticPopup.lng, syntheticPopup.lat],
        zoom: Math.max(mapRef.current.getZoom(), 12),
        duration: 800,
        essential: true,
      });
      return;
    }

    const popupData = {
      lng: best.coords.lng,
      lat: best.coords.lat,
      props: best.vehicle,
    };
    setSelectedRoute(routeHint || String(best.vehicle.route_id || 'ALL').toUpperCase());
    setFocusedStopMarker({
      lng: popupData.lng,
      lat: popupData.lat,
      stopId: targetStopId,
      routeId: String(best.vehicle.route_id || routeHint || 'ALL').toUpperCase(),
    });
    setPinnedInfo(popupData);
    setHoverInfo(popupData);
    mapRef.current?.flyTo({
      center: [popupData.lng, popupData.lat],
      zoom: Math.max(mapRef.current.getZoom(), 12),
      duration: 800,
      essential: true,
    });
  };

  const activePopup = pinnedInfo ?? hoverInfo;
  const activeStopId = useMemo(() => extractStopCode(activePopup?.props.stop_name), [activePopup]);

  return (
    <div className="w-screen h-screen bg-black relative overflow-hidden">
      <Map
        ref={mapRef}
        initialViewState={{ latitude: 40.73, longitude: -73.98, zoom: 11 }}
        mapStyle="mapbox://styles/mapbox/dark-v11"
        mapboxAccessToken={MAPBOX_TOKEN}
        scrollZoom={true}
        dragPan={true}
        dragRotate={false}
        touchZoomRotate={true}
        doubleClickZoom={true}
        keyboard={true}
        interactiveLayerIds={['transit-point']}
        onMouseMove={(e) => {
          if (pinnedInfo) return;
          const feature = e.features?.[0];
          if (feature) {
            setHoverInfo({ 
              lng: e.lngLat.lng, 
              lat: e.lngLat.lat, 
              props: feature.properties as Vehicle 
            });
            e.target.getCanvas().style.cursor = 'pointer';
          } else {
            setHoverInfo(null);
            e.target.getCanvas().style.cursor = '';
          }
        }}
        onClick={(e) => {
          const target = e.originalEvent?.target as HTMLElement | null;
          if (target?.closest('.mapboxgl-popup')) return;
          const feature = e.features?.[0];
          if (feature) {
            const popupData = {
              lng: e.lngLat.lng,
              lat: e.lngLat.lat,
              props: feature.properties as Vehicle,
            };
            setPinnedInfo(popupData);
            setHoverInfo(popupData);
            setFocusedStopMarker(null);
          } else {
            setPinnedInfo(null);
            setHoverInfo(null);
            setFocusedStopMarker(null);
          }
        }}
      >
        <NavigationControl position="top-right" />
        <GeolocateControl position="top-right" />

        <Source id="vehicles-source" type="geojson" data={geoJSON}>
          <Layer
            id="transit-glow"
            type="circle"
            paint={{
              'circle-radius': [
                'interpolate',
                ['linear'],
                ['zoom'],
                8,
                20,
                10,
                27,
                12,
                34,
                14,
                38
              ],
              'circle-color': layerColorExpression as any,
              'circle-opacity': 0.34,
              'circle-blur': 0.9
            }}
            beforeId="transit-point"
          />
          
          <Layer
            id="transit-point"
            type="circle"
            paint={{
              'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4, 14, 7],
              'circle-color': layerColorExpression as any,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#ffffff',
              'circle-opacity': 1
            }}
          />
        </Source>

        {focusedStopMarker ? (
          <Source
            id="focused-stop-source"
            type="geojson"
            data={{
              type: 'FeatureCollection',
              features: [
                {
                  type: 'Feature',
                  geometry: {
                    type: 'Point',
                    coordinates: [focusedStopMarker.lng, focusedStopMarker.lat],
                  },
                  properties: { stop_id: focusedStopMarker.stopId },
                },
              ],
            } as any}
          >
            <Layer
              id="focused-stop-glow"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 14, 14, 22],
                'circle-color': focusedRouteColor,
                'circle-opacity': 0.25,
                'circle-blur': 0.7,
              }}
            />
            <Layer
              id="focused-stop-core"
              type="circle"
              paint={{
                'circle-radius': ['interpolate', ['linear'], ['zoom'], 10, 4.5, 14, 7],
                'circle-color': focusedRouteColor,
                'circle-stroke-width': 2,
                'circle-stroke-color': '#ecfccb',
                'circle-opacity': 1,
              }}
            />
          </Source>
        ) : null}
        
        {activePopup && (
          <Popup
            longitude={activePopup.lng}
            latitude={activePopup.lat}
            closeButton={false}
            closeOnClick={false}
            offset={15}
            maxWidth="320px"
            className="transit-popup"
            onClose={() => {
              setPinnedInfo(null);
              setFocusedStopMarker(null);
            }}
          >
            <VehiclePopup
              info={activePopup}
              t={t}
              canFavoriteStop={!!user}
              isStopFavorited={activeStopId ? favoriteStopSet.has(activeStopId) : false}
              onToggleFavoriteStop={handleToggleStopFavorite}
              onPinPopup={() => {
                if (!pinnedInfo && activePopup) setPinnedInfo(activePopup);
              }}
            />
          </Popup>
        )}
      </Map>

      {/* 控制面板 */}
      <ControlPanel 
        selectedRoute={selectedRoute} 
        onSelectRoute={setSelectedRoute} 
        count={count}
        timeRange={timeRange}
        compareMode={compareMode}
        onTimeRangeChange={setTimeRange}
        onCompareModeChange={setCompareMode}
        trendSeries={trend.series}
        previousTrendSeries={trend.previous_series}
        averageCount={trend.current_avg}
        comparisonDelta={trend.delta}
        comparisonPercent={trend.delta_percent}
        topRoutes={routeCountsFallback.map((r) => ({ routeId: r.route_id, vehicleCount: r.vehicle_count }))}
        routeVehicleCounts={routeVehicleCounts}
        language={language}
        onLanguageChange={setLanguage}
        t={t}
        user={user}
        authMode={authMode}
        authForm={authForm}
        onAuthModeChange={setAuthMode}
        onAuthFormChange={setAuthForm}
        onSubmitAuth={handleSubmitAuth}
        onLogout={handleLogout}
        favoriteRoutes={favoriteRoutes}
        favoriteStops={favoriteStops}
        onToggleRouteFavorite={handleToggleRouteFavorite}
        onFocusFavoriteRoute={handleFocusFavoriteRoute}
        onFocusFavoriteStop={handleFocusFavoriteStop}
        notificationCenter={notificationCenter}
        notificationSettings={notificationSettings}
        onToggleEmailNotifications={(enabled) =>
          updateNotificationSettings({ email_notifications_enabled: enabled }).then(setNotificationSettings)
        }
        onMarkNotificationRead={async (id) => {
          await markNotificationRead(id);
          setNotificationCenter(await fetchNotificationCenter());
        }}
        onMarkAllNotificationsRead={async () => {
          await markAllNotificationsRead();
          setNotificationCenter(await fetchNotificationCenter());
        }}
        unreadCount={unreadCount}
      />
      {authError ? (
        <div className="absolute bottom-5 left-5 z-20 px-3 py-2 rounded-lg bg-red-600/90 text-white text-xs shadow-lg">
          {authError}
        </div>
      ) : null}
    </div>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TransitMap />
    </QueryClientProvider>
  );
}

export default App;