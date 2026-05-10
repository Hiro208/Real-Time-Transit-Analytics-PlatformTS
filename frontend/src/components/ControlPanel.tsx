// src/components/ControlPanel.tsx
import React from 'react';
import { ROUTE_COLORS } from '../config/constants';
import type { FavoriteStop, NotificationItem, NotificationSettings, User, VehicleInsightPoint } from '../types/transit';
import type { Language, TranslateFn } from '../i18n';

interface DropdownOption {
  value: string;
  label: string;
}

const StyledDropdown: React.FC<{
  value: string;
  options: DropdownOption[];
  onChange: (value: string) => void;
  ariaLabel: string;
  onOpenChange?: (open: boolean) => void;
}> = ({ value, options, onChange, ariaLabel, onOpenChange }) => {
  const [open, setOpen] = React.useState(false);
  const selected = options.find((o) => o.value === value) || options[0];
  React.useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);

  return (
    <div
      className="relative"
      tabIndex={0}
      onBlur={(e) => {
        const next = e.relatedTarget as Node | null;
        if (!next || !e.currentTarget.contains(next)) setOpen(false);
      }}
    >
      <button
        type="button"
        className="flex w-full items-center justify-between rounded-lg border border-green-500/35 bg-black/35 px-2 py-1.5 text-xs text-white outline-none transition hover:bg-black/45 focus:border-green-400/80"
        onClick={() => setOpen((v) => !v)}
        aria-label={ariaLabel}
      >
        <span>{selected?.label}</span>
        <span className={`ml-2 text-[10px] text-green-300 transition ${open ? 'rotate-180' : ''}`}>▼</span>
      </button>
      {open ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-full overflow-hidden rounded-lg border border-green-500/35 bg-[rgba(10,10,10,0.98)] shadow-[0_12px_28px_rgba(0,0,0,0.55)]">
          {options.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              className={`block w-full px-2 py-2 text-left text-xs transition ${
                opt.value === value
                  ? 'bg-green-500/18 text-green-200'
                  : 'text-gray-200 hover:bg-green-500/10 hover:text-green-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
};

interface Props {
  selectedRoute: string;
  onSelectRoute: (route: string) => void;
  count: number;
  timeRange: '15m' | '1h' | '6h' | '24h';
  compareMode: 'none' | 'previous';
  onTimeRangeChange: (range: '15m' | '1h' | '6h' | '24h') => void;
  onCompareModeChange: (mode: 'none' | 'previous') => void;
  trendSeries: VehicleInsightPoint[];
  previousTrendSeries: VehicleInsightPoint[];
  averageCount: number;
  comparisonDelta: number | null;
  comparisonPercent: number | null;
  topRoutes: Array<{ routeId: string; vehicleCount: number }>;
  routeVehicleCounts: Record<string, number>;
  language: Language;
  onLanguageChange: (language: Language) => void;
  t: TranslateFn;
  user: User | null;
  authMode: 'login' | 'register';
  authForm: { email: string; password: string };
  onAuthModeChange: (mode: 'login' | 'register') => void;
  onAuthFormChange: (value: { email: string; password: string }) => void;
  onSubmitAuth: () => void;
  onLogout: () => void;
  favoriteRoutes: Set<string>;
  favoriteStops: FavoriteStop[];
  onToggleRouteFavorite: (routeId: string) => void;
  onFocusFavoriteRoute: (routeId: string) => void;
  onFocusFavoriteStop: (stop: FavoriteStop) => void;
  notificationCenter: NotificationItem[];
  notificationSettings: NotificationSettings | null;
  onToggleEmailNotifications: (enabled: boolean) => void;
  onMarkNotificationRead: (id: number) => void;
  onMarkAllNotificationsRead: () => void;
  unreadCount: number;
}

const ControlPanel: React.FC<Props> = ({
  selectedRoute,
  onSelectRoute,
  count,
  timeRange,
  compareMode,
  onTimeRangeChange,
  onCompareModeChange,
  trendSeries,
  previousTrendSeries,
  averageCount,
  comparisonDelta,
  comparisonPercent,
  topRoutes,
  routeVehicleCounts,
  language,
  onLanguageChange,
  t,
  user,
  authMode,
  authForm,
  onAuthModeChange,
  onAuthFormChange,
  onSubmitAuth,
  onLogout,
  favoriteRoutes,
  favoriteStops,
  onToggleRouteFavorite,
  onFocusFavoriteRoute,
  onFocusFavoriteStop,
  notificationCenter,
  notificationSettings,
  onToggleEmailNotifications,
  onMarkNotificationRead,
  onMarkAllNotificationsRead,
  unreadCount,
}) => {
  const [selectedNotification, setSelectedNotification] = React.useState<NotificationItem | null>(null);
  const [insightExpanded, setInsightExpanded] = React.useState(false);
  const [chartView, setChartView] = React.useState({ start: 0, end: 1 });
  const chartDragRef = React.useRef<{ dragging: boolean; lastClientX: number }>({
    dragging: false,
    lastClientX: 0,
  });
  const [insightDropdownOpen, setInsightDropdownOpen] = React.useState({
    range: false,
    compare: false,
  });

  React.useEffect(() => {
    if (insightExpanded) {
      setChartView({ start: 0, end: 1 });
    }
  }, [insightExpanded, timeRange, compareMode, selectedRoute]);

  const closeNotificationModal = () => setSelectedNotification(null);
  const sectionClass = 'mt-4 rounded-2xl border border-green-500/35 bg-black/35 p-4';
  const isInsightOpen = insightDropdownOpen.range || insightDropdownOpen.compare;
  const currentWindowPoints = trendSeries.map((p) => p.count);
  const previousWindowPoints = previousTrendSeries.map((p) => p.count);
  const chartPoints = currentWindowPoints.length > 1 ? currentWindowPoints : [count, count];
  const chartTotal = chartPoints.length;
  const minChartWindow = 0.15;
  const clampedViewStart = Math.max(0, Math.min(chartView.start, 1 - minChartWindow));
  const clampedViewEnd = Math.min(1, Math.max(chartView.end, clampedViewStart + minChartWindow));
  const currentStartIdx = Math.floor(clampedViewStart * Math.max(chartTotal - 1, 1));
  const currentEndIdx = Math.max(
    currentStartIdx + 1,
    Math.ceil(clampedViewEnd * Math.max(chartTotal - 1, 1))
  );
  const visibleChartPoints = chartPoints.slice(currentStartIdx, currentEndIdx + 1);
  const visibleTrendSeries = trendSeries.slice(currentStartIdx, currentEndIdx + 1);
  const previousTotal = previousWindowPoints.length;
  const previousStartIdx = Math.floor(clampedViewStart * Math.max(previousTotal - 1, 1));
  const previousEndIdx = Math.max(
    previousStartIdx + 1,
    Math.ceil(clampedViewEnd * Math.max(previousTotal - 1, 1))
  );
  const visiblePreviousPoints =
    previousTotal > 1 ? previousWindowPoints.slice(previousStartIdx, previousEndIdx + 1) : [];
  const currentMinPoint = Math.min(...chartPoints);
  const currentMaxPoint = Math.max(...chartPoints);
  const hasPreviousSeries = compareMode === 'previous' && visiblePreviousPoints.length > 1;
  const yScalePoints = hasPreviousSeries ? [...visibleChartPoints, ...visiblePreviousPoints] : visibleChartPoints;
  const minPoint = Math.min(...yScalePoints);
  const maxPoint = Math.max(...yScalePoints);
  const pointRange = Math.max(maxPoint - minPoint, 1);
  const latestPoint = chartPoints[chartPoints.length - 1] ?? count;
  const firstPoint = chartPoints[0] ?? count;
  const startToNowDelta = latestPoint - firstPoint;
  const startToNowPercent = firstPoint === 0 ? null : Math.round((startToNowDelta / firstPoint) * 100);
  const mean = chartPoints.reduce((sum, v) => sum + v, 0) / chartPoints.length;
  const variance = chartPoints.reduce((sum, v) => sum + (v - mean) ** 2, 0) / chartPoints.length;
  const volatility = Number(Math.sqrt(variance).toFixed(1));
  const anomalyThreshold = Math.max(volatility * 1.6, 3);
  const anomalyIndexes = chartPoints
    .map((value, idx) => ({ idx, value }))
    .filter((item) => Math.abs(item.value - mean) >= anomalyThreshold)
    .map((item) => item.idx);
  const anomalySet = new Set(anomalyIndexes);
  const peakIndex = chartPoints.findIndex((p) => p === currentMaxPoint);
  const troughIndex = chartPoints.findIndex((p) => p === currentMinPoint);
  const favoriteRouteStats = Array.from(favoriteRoutes)
    .sort()
    .map((routeId) => ({
      routeId,
      vehicleCount: routeVehicleCounts[routeId] || 0,
    }));
  const activeFavoriteCount = favoriteRouteStats.filter((r) => r.vehicleCount > 0).length;
  const networkSeverity: 'normal' | 'watch' | 'severe' =
    anomalyIndexes.length >= 8 || (comparisonDelta ?? 0) >= 15
      ? 'severe'
      : anomalyIndexes.length >= 4 || (comparisonDelta ?? 0) >= 6
      ? 'watch'
      : 'normal';
  const networkStatusView = {
    normal: {
      label: t('statusNormal'),
      dotClass: 'bg-green-400',
      textClass: 'text-green-200',
    },
    watch: {
      label: t('statusWatch'),
      dotClass: 'bg-yellow-300',
      textClass: 'text-yellow-200',
    },
    severe: {
      label: t('statusSevere'),
      dotClass: 'bg-red-400',
      textClass: 'text-red-200',
    },
  }[networkSeverity];

  const sparklinePath = chartPoints
    .map((point, idx) => {
      const x = (idx / (chartPoints.length - 1 || 1)) * 100;
      // Keep top/bottom padding so flat trends remain visible.
      const y = 90 - ((point - minPoint) / pointRange) * 80;
      return `${x},${y}`;
    })
    .join(' ');
  const maxRouteCount = topRoutes.length > 0 ? Math.max(...topRoutes.map((r) => r.vehicleCount)) : 1;
  const detailedChartWidth = 1000;
  const detailedChartHeight = 280;
  const detailedChartTop = 28;
  const detailedChartBottom = 248;
  const detailedChartInnerLeft = 70;
  const detailedChartInnerRight = 980;
  const detailedChartInnerWidth = Math.max(detailedChartInnerRight - detailedChartInnerLeft, 1);
  const detailedChartRange = Math.max(detailedChartBottom - detailedChartTop, 1);
  const detailedPoints = visibleChartPoints.map((point, idx) => {
    const rawIdx = currentStartIdx + idx;
    const x =
      detailedChartInnerLeft +
      (idx / (visibleChartPoints.length - 1 || 1)) * detailedChartInnerWidth;
    const y = detailedChartBottom - ((point - minPoint) / pointRange) * detailedChartRange;
    return { idx, rawIdx, x, y, point };
  });
  const previousDetailedPoints = visiblePreviousPoints.map((point, idx) => {
    const x =
      detailedChartInnerLeft +
      (idx / (visiblePreviousPoints.length - 1 || 1)) * detailedChartInnerWidth;
    const y = detailedChartBottom - ((point - minPoint) / pointRange) * detailedChartRange;
    return { idx, x, y, point };
  });
  const detailedPath = detailedPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const previousDetailedPath = previousDetailedPoints.map((p) => `${p.x},${p.y}`).join(' ');
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = detailedChartBottom - ratio * detailedChartRange;
    const value = Math.round(minPoint + ratio * (maxPoint - minPoint));
    return { y, value };
  });
  const pointDisplayIndexes = new Set<number>();
  for (let i = 0; i < visibleChartPoints.length; i++) {
    const current = visibleChartPoints[i];
    const prev = i > 0 ? visibleChartPoints[i - 1] : current;
    const next = i < visibleChartPoints.length - 1 ? visibleChartPoints[i + 1] : current;
    const isEdge = i === 0 || i === visibleChartPoints.length - 1;
    const isChangePoint = current !== prev || current !== next;
    if (isEdge || isChangePoint) {
      pointDisplayIndexes.add(i);
    }
  }
  const formatSigned = (value: number) => (value >= 0 ? `+${value}` : `${value}`);
  const tickIndices = (() => {
    if (visibleTrendSeries.length <= 1) return [0];
    const raw = [
      0,
      Math.floor((visibleTrendSeries.length - 1) / 3),
      Math.floor(((visibleTrendSeries.length - 1) * 2) / 3),
      visibleTrendSeries.length - 1,
    ];
    return Array.from(new Set(raw));
  })();
  const formatTickTime = (ts?: number) => {
    if (!ts) return '--:--';
    const d = new Date(ts);
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${hh}:${mm}`;
  };

  return (
    <>
      <div className="absolute top-5 left-5 z-10 w-[23rem] max-h-[calc(100vh-2.5rem)] overflow-auto rounded-3xl border border-green-500/35 bg-[rgba(15,15,15,0.88)] p-5 text-white shadow-2xl backdrop-blur-md">
        <div className="mb-4 border-b border-green-500/25 pb-4">
          <h1 className="m-0 text-2xl font-black tracking-tighter">{t('transitConsole')}</h1>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-green-400">{t('nycNode')}</p>
          <div className="mt-3 flex items-center justify-between">
            <span className="text-[11px] text-neutral-300">{t('language')}</span>
            <select
              value={language}
              onChange={(e) => onLanguageChange(e.target.value as Language)}
              className="rounded-lg border border-green-500/35 bg-black/35 px-2 py-1 text-[11px] text-white outline-none transition focus:border-green-400/80"
            >
              <option value="en" className="bg-neutral-900">{t('lang_en')}</option>
              <option value="zh" className="bg-neutral-900">{t('lang_zh')}</option>
              <option value="es" className="bg-neutral-900">{t('lang_es')}</option>
            </select>
          </div>
        </div>

        <div className="flex gap-2">
          <select
            value={selectedRoute}
            onChange={(e) => onSelectRoute(e.target.value)}
            className="flex-1 cursor-pointer appearance-none rounded-2xl border border-green-500/35 bg-black/35 px-3 py-3 text-sm font-semibold text-white outline-none transition hover:bg-black/45 focus:border-green-400/80"
            title={t('allActiveLines')}
          >
            <option value="ALL">{t('allActiveLines')}</option>
            {Object.keys(ROUTE_COLORS).map((route) => (
              <option key={route} value={route} className="bg-neutral-900">
                {route} {t('lineSuffix')}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!user || selectedRoute === 'ALL'}
            onClick={() => selectedRoute !== 'ALL' && onToggleRouteFavorite(selectedRoute)}
            className={`w-12 rounded-2xl border text-xl transition ${
              selectedRoute !== 'ALL' && favoriteRoutes.has(selectedRoute)
                ? 'border-yellow-400/70 bg-yellow-400/15 text-yellow-300 shadow-[0_0_16px_rgba(250,204,21,0.22)]'
                : 'border-green-500/35 bg-black/35 text-gray-300'
            } ${!user ? 'cursor-not-allowed opacity-40' : 'hover:bg-black/45'}`}
            title={!user ? t('loginRequiredRoute') : t('favoriteThisRoute')}
          >
            ★
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-green-500/30 bg-gradient-to-r from-green-500/18 via-green-500/10 to-transparent p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-5xl font-extrabold leading-none text-white">{count}</div>
              <div className="mt-1 text-[10px] font-bold uppercase tracking-wider text-white/80">
                {t('activeVehicles')}
              </div>
            </div>
            <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-green-500" />
          </div>
        </div>

        <div
          className={`${sectionClass} transition ${
            isInsightOpen
              ? 'border-green-400/70 shadow-[0_0_18px_rgba(34,197,94,0.2)]'
              : ''
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold text-white">{t('insightWindow')}</div>
            <div className="flex items-center gap-2">
              <div className="text-[11px] text-gray-400">{t('windowAvg')}: {averageCount}</div>
              <button
                type="button"
                onClick={() => setInsightExpanded(true)}
                className="rounded-md border border-green-400/35 px-2 py-1 text-[10px] font-semibold text-green-200 transition hover:bg-green-500/15"
              >
                {t('expand')}
              </button>
            </div>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2">
            <StyledDropdown
              value={timeRange}
              onChange={(value) => onTimeRangeChange(value as '15m' | '1h' | '6h' | '24h')}
              ariaLabel={t('insightWindow')}
              onOpenChange={(open) =>
                setInsightDropdownOpen((prev) => ({ ...prev, range: open }))
              }
              options={[
                { value: '15m', label: t('range15m') },
                { value: '1h', label: t('range1h') },
                { value: '6h', label: t('range6h') },
                { value: '24h', label: t('range24h') },
              ]}
            />
            <StyledDropdown
              value={compareMode}
              onChange={(value) => onCompareModeChange(value as 'none' | 'previous')}
              ariaLabel={t('comparePrevious')}
              onOpenChange={(open) =>
                setInsightDropdownOpen((prev) => ({ ...prev, compare: open }))
              }
              options={[
                { value: 'none', label: t('compareNone') },
                { value: 'previous', label: t('comparePrevious') },
              ]}
            />
          </div>

          <div className="h-16 rounded-lg border border-green-500/20 bg-black/30 p-2">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
              <defs>
                <linearGradient id="trendStroke" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="rgba(34,197,94,0.4)" />
                  <stop offset="100%" stopColor="rgba(74,222,128,1)" />
                </linearGradient>
              </defs>
              <polyline
                fill="none"
                stroke="url(#trendStroke)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                points={sparklinePath}
              />
            </svg>
          </div>

          <div className="mt-2 text-xs">
            {comparisonDelta == null ? (
              <span className="text-gray-400">{t('noComparisonData')}</span>
            ) : (
              <span className={comparisonDelta >= 0 ? 'text-green-300' : 'text-red-300'}>
                {comparisonDelta >= 0 ? '+' : ''}
                {comparisonDelta}{' '}
                {t('vsPrevious')}
                {comparisonPercent != null ? ` (${comparisonPercent >= 0 ? '+' : ''}${comparisonPercent}%)` : ''}
              </span>
            )}
          </div>

          <div className="mt-3 border-t border-green-500/20 pt-3">
            <div className="mb-2 text-[11px] uppercase tracking-wide text-gray-300">{t('topActiveRoutes')}</div>
            {topRoutes.length > 0 ? (
              <div className="space-y-1.5">
                {topRoutes.map((route) => {
                  const width = Math.max((route.vehicleCount / maxRouteCount) * 100, 8);
                  return (
                    <div key={route.routeId} className="flex items-center gap-2 text-xs">
                      <span className="w-5 font-semibold text-green-300">{route.routeId}</span>
                      <div className="h-2 flex-1 rounded-full bg-black/50">
                        <div
                          className="h-2 rounded-full bg-gradient-to-r from-green-500/55 to-green-300/80"
                          style={{ width: `${width}%` }}
                        />
                      </div>
                      <span className="w-6 text-right text-gray-300">{route.vehicleCount}</span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-xs text-gray-500">{t('noRouteData')}</div>
            )}
          </div>
        </div>

        {!user ? (
          <div className={sectionClass}>
            <div>
              <div className="mb-3 flex overflow-hidden rounded-xl border border-green-500/35 text-xs">
                <button
                  type="button"
                  onClick={() => onAuthModeChange('login')}
                  className={`flex-1 py-2 ${authMode === 'login' ? 'bg-green-600/90' : 'bg-white/[0.05] hover:bg-white/[0.1]'}`}
                >
                  {t('login')}
                </button>
                <button
                  type="button"
                  onClick={() => onAuthModeChange('register')}
                  className={`flex-1 py-2 ${authMode === 'register' ? 'bg-green-600/90' : 'bg-white/[0.05] hover:bg-white/[0.1]'}`}
                >
                  {t('register')}
                </button>
              </div>
              <input
                type="email"
                placeholder={t('email')}
                value={authForm.email}
                onChange={(e) => onAuthFormChange({ ...authForm, email: e.target.value })}
                className="mb-2 w-full rounded-xl border border-green-500/35 bg-black/30 px-3 py-2 text-sm outline-none transition focus:border-green-400/80"
              />
              <input
                type="password"
                placeholder={t('passwordHint')}
                value={authForm.password}
                onChange={(e) => onAuthFormChange({ ...authForm, password: e.target.value })}
                className="mb-2 w-full rounded-xl border border-green-500/35 bg-black/30 px-3 py-2 text-sm outline-none transition focus:border-green-400/80"
              />
              <button
                type="button"
                onClick={onSubmitAuth}
                className="w-full rounded-xl bg-green-600 py-2 text-sm font-semibold transition hover:bg-green-500"
              >
                {authMode === 'login' ? t('login') : t('createAccount')}
              </button>
            </div>
          </div>
        ) : null}

        {user ? (
          <>
            <div className={sectionClass}>
              <div className="mb-3 text-sm font-semibold text-gray-100">{t('favorites')}</div>
              <div className="space-y-3 text-xs">
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">{t('routes')}</div>
                  <div className="flex flex-wrap gap-1.5">
                    {Array.from(favoriteRoutes).length > 0 ? (
                      Array.from(favoriteRoutes)
                        .sort()
                        .map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() => onFocusFavoriteRoute(r)}
                            className="rounded-lg border border-yellow-500/35 bg-yellow-400/15 px-2 py-1 text-yellow-100"
                            title={`Focus ${r}`}
                          >
                            {r}
                          </button>
                        ))
                    ) : (
                      <span className="text-gray-500">{t('noFavoriteRoutes')}</span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="mb-1 text-[11px] uppercase tracking-wide text-gray-400">{t('stops')}</div>
                  <div className="max-h-20 space-y-1 overflow-auto pr-1 text-yellow-100/90">
                    {favoriteStops.length > 0 ? (
                      favoriteStops.map((s) => (
                        <button
                          key={s.stop_id}
                          type="button"
                          onClick={() => onFocusFavoriteStop(s)}
                          className="block w-full rounded-md border border-white/10 bg-black/20 px-2 py-1 text-left transition hover:bg-black/35"
                          title={`Focus ${s.stop_id}`}
                        >
                          {s.stop_name || s.stop_id}
                        </button>
                      ))
                    ) : (
                      <div className="text-gray-500">{t('noFavoriteStops')}</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-yellow-500/35 bg-gradient-to-b from-yellow-500/12 to-yellow-500/6 p-4">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-xl font-bold text-yellow-300">{t('notificationCenter')}</div>
                <div className="rounded-full border border-yellow-300/30 bg-yellow-500/20 px-2 py-0.5 text-[11px] text-yellow-100">
                  {unreadCount} {t('unread')}
                </div>
              </div>

              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-yellow-500/20 bg-black/15 px-3 py-2">
                <span className="text-xs font-medium text-yellow-100">{t('email')}</span>
                <button
                  type="button"
                  onClick={() => onToggleEmailNotifications(!notificationSettings?.email_notifications_enabled)}
                  className={`relative h-6 w-11 rounded-full transition ${
                    notificationSettings?.email_notifications_enabled ? 'bg-green-500/90' : 'bg-white/20'
                  }`}
                  aria-label={t('email')}
                >
                  <span
                    className={`absolute top-[2px] h-5 w-5 rounded-full bg-white transition ${
                      notificationSettings?.email_notifications_enabled ? 'left-[22px]' : 'left-[2px]'
                    }`}
                  />
                </button>
              </div>

              <div className="mb-3 flex justify-end">
                <button
                  type="button"
                  onClick={onMarkAllNotificationsRead}
                  className="rounded-lg border border-white/15 bg-white/[0.08] px-3 py-1.5 text-xs font-medium text-white transition hover:bg-white/[0.15]"
                >
                  {t('markAllRead')}
                </button>
              </div>

              {notificationCenter.length > 0 ? (
                <div className="max-h-56 space-y-2 overflow-auto pr-1">
                  {notificationCenter.slice(0, 20).map((n) => (
                    <button
                      key={n.id}
                      type="button"
                      onClick={() => {
                        onMarkNotificationRead(n.id);
                        setSelectedNotification(n);
                      }}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${
                        n.is_read
                          ? 'border-yellow-700/40 bg-yellow-500/[0.06] text-yellow-100/70'
                          : 'border-yellow-300/50 bg-yellow-500/[0.14] text-yellow-100 hover:bg-yellow-500/[0.2]'
                      }`}
                    >
                      <div className="line-clamp-1 text-sm font-semibold">{n.title}</div>
                      <div className="mt-0.5 text-[11px] text-yellow-200/80">{n.effect_text || t('update')}</div>
                      {n.body ? <div className="mt-1 line-clamp-2 text-xs text-yellow-100/90">{n.body}</div> : null}
                      <div className="mt-1 text-[10px] opacity-80">
                        {n.email_sent ? t('emailSent') : t('emailPending')}
                      </div>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="text-xs text-yellow-100/80">{t('noNotifications')}</div>
              )}
            </div>
            <div className={sectionClass}>
              <div className="text-sm font-semibold text-white">
                {t('signedInAs')}: <span className="text-white">{user.email}</span>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-3 w-full rounded-xl border border-green-500/35 bg-black/35 py-2 text-sm font-medium text-white transition hover:bg-black/45"
              >
                {t('signOut')}
              </button>
            </div>
          </>
        ) : null}
      </div>

      {selectedNotification ? (
        <div
          className="fixed inset-0 z-40 flex items-center justify-center bg-black/65 backdrop-blur-[2px] px-4"
          onClick={closeNotificationModal}
        >
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-auto rounded-2xl border border-yellow-500/40 bg-neutral-900 text-yellow-100 shadow-[0_0_30px_rgba(234,179,8,0.25)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-yellow-500/20 bg-neutral-900/95 px-5 py-4 backdrop-blur">
              <div>
                <div className="text-xs uppercase tracking-wider text-yellow-300/80">
                  {selectedNotification.effect_text || t('serviceAlert')}
                </div>
                <h3 className="mt-1 text-lg font-semibold leading-tight text-yellow-100">
                  {selectedNotification.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeNotificationModal}
                className="h-8 w-8 rounded-full border border-yellow-500/30 text-yellow-100 hover:bg-yellow-500/20"
                aria-label="Close notification details"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-5 py-4 text-sm text-yellow-100/95">
              <p className="whitespace-pre-wrap leading-relaxed">
                {selectedNotification.body || t('noDetails')}
              </p>
              <div className="text-xs text-yellow-200/80">
                <div>
                  {selectedNotification.email_sent ? t('emailSent') : t('emailPending')}
                </div>
                <div className="mt-1">
                  {t('createdAt')}: {new Date(selectedNotification.created_at).toLocaleString()}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {insightExpanded ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-[2px] px-4"
          onClick={() => setInsightExpanded(false)}
        >
          <div
            className="w-full max-w-5xl max-h-[86vh] overflow-auto rounded-2xl border border-green-500/35 bg-neutral-950 text-white shadow-[0_0_36px_rgba(34,197,94,0.2)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-green-500/20 bg-neutral-950/95 px-5 py-4 backdrop-blur">
              <div>
                <h3 className="text-xl font-bold">{t('detailedInsights')}</h3>
              </div>
              <button
                type="button"
                onClick={() => setInsightExpanded(false)}
                className="rounded-lg border border-white/15 px-3 py-1.5 text-xs font-semibold text-gray-100 transition hover:bg-white/[0.08]"
              >
                {t('close')}
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                <div className="rounded-xl border border-green-500/25 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{t('networkStatus')}</div>
                  <div className={`mt-2 inline-flex items-center gap-2 text-xl font-extrabold ${networkStatusView.textClass}`}>
                    <span className={`h-3 w-3 rounded-full ${networkStatusView.dotClass}`} />
                    {networkStatusView.label}
                  </div>
                </div>
                <div className="rounded-xl border border-green-500/25 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{t('currentSnapshot')}</div>
                  <div className="mt-1 text-2xl font-extrabold text-green-200">{latestPoint}</div>
                </div>
                <div className="rounded-xl border border-green-500/25 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{t('startToNow')}</div>
                  <div className={`mt-1 text-2xl font-extrabold ${startToNowDelta >= 0 ? 'text-green-300' : 'text-red-300'}`}>
                    {formatSigned(startToNowDelta)}
                    {startToNowPercent != null ? (
                      <span className="ml-1 text-sm font-semibold">
                        ({formatSigned(startToNowPercent)}%)
                      </span>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-xl border border-green-500/25 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{t('peakValue')} / {t('troughValue')}</div>
                  <div className="mt-1 text-2xl font-extrabold text-white">{maxPoint} / {minPoint}</div>
                </div>
                <div className="rounded-xl border border-green-500/25 bg-black/30 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-gray-400">{t('volatility')}</div>
                  <div className="mt-1 text-2xl font-extrabold text-white">{volatility}</div>
                </div>
              </div>

              <div className="rounded-xl border border-green-500/25 bg-black/25 p-3">
                <div className="mb-2 flex items-center justify-between text-xs text-gray-300">
                  <span>{t('insightWindow')}</span>
                  <span>{t('windowAvg')}: {averageCount}</span>
                </div>
                <div
                  className="h-64 rounded-lg border border-green-500/20 bg-black/40 p-2"
                  onWheel={(e) => {
                    e.preventDefault();
                    const rect = e.currentTarget.getBoundingClientRect();
                    const pointerRatio = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
                    const currentWidth = clampedViewEnd - clampedViewStart;
                    const zoomFactor = e.deltaY < 0 ? 0.88 : 1.12;
                    const nextWidth = Math.max(minChartWindow, Math.min(1, currentWidth * zoomFactor));
                    const pointerValue = clampedViewStart + pointerRatio * currentWidth;
                    let nextStart = pointerValue - pointerRatio * nextWidth;
                    let nextEnd = nextStart + nextWidth;
                    if (nextStart < 0) {
                      nextStart = 0;
                      nextEnd = nextWidth;
                    }
                    if (nextEnd > 1) {
                      nextEnd = 1;
                      nextStart = 1 - nextWidth;
                    }
                    setChartView({ start: nextStart, end: nextEnd });
                  }}
                  onMouseDown={(e) => {
                    chartDragRef.current = { dragging: true, lastClientX: e.clientX };
                  }}
                  onMouseMove={(e) => {
                    if (!chartDragRef.current.dragging) return;
                    const rect = e.currentTarget.getBoundingClientRect();
                    const dxRatio = (e.clientX - chartDragRef.current.lastClientX) / rect.width;
                    chartDragRef.current.lastClientX = e.clientX;
                    const width = clampedViewEnd - clampedViewStart;
                    let nextStart = clampedViewStart - dxRatio * width;
                    let nextEnd = clampedViewEnd - dxRatio * width;
                    if (nextStart < 0) {
                      nextStart = 0;
                      nextEnd = width;
                    }
                    if (nextEnd > 1) {
                      nextEnd = 1;
                      nextStart = 1 - width;
                    }
                    setChartView({ start: nextStart, end: nextEnd });
                  }}
                  onMouseUp={() => {
                    chartDragRef.current.dragging = false;
                  }}
                  onMouseLeave={() => {
                    chartDragRef.current.dragging = false;
                  }}
                  style={{ cursor: chartDragRef.current.dragging ? 'grabbing' : 'grab' }}
                >
                  <svg
                    viewBox={`0 0 ${detailedChartWidth} ${detailedChartHeight}`}
                    preserveAspectRatio="none"
                    className="h-full w-full"
                  >
                    <defs>
                      <linearGradient id="trendStrokeDetailed" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="rgba(34,197,94,0.45)" />
                        <stop offset="100%" stopColor="rgba(74,222,128,1)" />
                      </linearGradient>
                    </defs>
                    {yTicks.map((tick) => (
                      <line
                        key={`grid-${tick.y}`}
                        x1={detailedChartInnerLeft}
                        y1={tick.y}
                        x2={detailedChartInnerRight}
                        y2={tick.y}
                        stroke="rgba(148,163,184,0.35)"
                        strokeWidth="1.2"
                        strokeDasharray="6 8"
                      />
                    ))}
                    <polyline
                      fill="none"
                      stroke="url(#trendStrokeDetailed)"
                      strokeWidth="2.8"
                      strokeLinejoin="round"
                      strokeLinecap="round"
                      points={detailedPath}
                    />
                    {hasPreviousSeries ? (
                      <polyline
                        fill="none"
                        stroke="rgba(148,163,184,0.9)"
                        strokeWidth="2.1"
                        strokeLinejoin="round"
                        strokeLinecap="round"
                        strokeDasharray="6 8"
                        points={previousDetailedPath}
                      />
                    ) : null}
                    {detailedPoints
                      .filter((_, idx) => pointDisplayIndexes.has(idx))
                      .map((p, idx) => (
                      <circle
                        key={`${p.idx}-${p.point}-${idx}`}
                        cx={p.x}
                        cy={p.y}
                        r={4.2}
                        fill="#4ade80"
                        stroke="rgba(2,6,23,0.95)"
                        strokeWidth="1.5"
                      />
                    ))}
                    <line
                      x1={detailedChartInnerLeft}
                      y1={detailedChartBottom + 12}
                      x2={detailedChartInnerRight}
                      y2={detailedChartBottom + 12}
                      stroke="rgba(148,163,184,0.45)"
                      strokeWidth="1.2"
                    />
                    <text
                      x={10}
                      y={14}
                      fill="rgba(148,163,184,0.85)"
                      fontSize="11"
                      fontWeight="600"
                    >
                      Y: Active Vehicles
                    </text>
                    {yTicks.map((tick) => (
                      <text
                        key={`y-label-${tick.y}`}
                        x={detailedChartInnerLeft - 12}
                        y={tick.y + 4}
                        textAnchor="end"
                        fill="rgba(148,163,184,0.85)"
                        fontSize="12"
                        style={{ fontVariantNumeric: 'tabular-nums' }}
                      >
                        {tick.value}
                      </text>
                    ))}
                  </svg>
                </div>
                <div className="mt-2 flex items-center justify-between px-1 text-[11px] text-slate-300">
                  {tickIndices.map((tickIdx) => (
                    <span
                      key={`tick-label-${tickIdx}`}
                      className="select-none"
                      style={{ fontVariantNumeric: 'tabular-nums' }}
                    >
                      {formatTickTime(visibleTrendSeries[tickIdx]?.ts)}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[11px] text-slate-400">X: Time</div>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <div className="rounded-xl border border-green-500/25 bg-black/25 p-3">
                  <div className="mb-2 text-xs uppercase tracking-wide text-gray-400">{t('topActiveRoutes')}</div>
                  {topRoutes.length > 0 ? (
                    <div className="space-y-2">
                      {topRoutes.map((route) => {
                        const width = Math.max((route.vehicleCount / maxRouteCount) * 100, 8);
                        return (
                          <div key={`expanded-${route.routeId}`} className="flex items-center gap-2 text-xs">
                            <span className="w-5 font-semibold text-green-300">{route.routeId}</span>
                            <div className="h-2 flex-1 rounded-full bg-black/50">
                              <div
                                className="h-2 rounded-full bg-gradient-to-r from-green-500/55 to-green-300/80"
                                style={{ width: `${width}%` }}
                              />
                            </div>
                            <span className="w-7 text-right text-gray-300">{route.vehicleCount}</span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-gray-500">{t('noRouteData')}</div>
                  )}
                </div>
                <div className="rounded-xl border border-green-500/25 bg-black/25 p-3 text-sm text-gray-200">
                  <div className="text-xs uppercase tracking-wide text-gray-400">{t('favoriteRoutesNow')}</div>
                  <div className="mt-2 text-xs text-gray-300">
                    {activeFavoriteCount} {t('routesWithService')}
                  </div>
                  <div className="mt-3 space-y-2">
                    {favoriteRouteStats.length > 0 ? (
                      favoriteRouteStats.map((route) => (
                        <div key={`fav-${route.routeId}`} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-xs">
                          <span className="font-semibold text-green-200">{route.routeId}</span>
                          <span className={route.vehicleCount > 0 ? 'text-green-300' : 'text-gray-500'}>
                            {route.vehicleCount}
                          </span>
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">{t('noFavoriteRoutes')}</div>
                    )}
                  </div>
                  {favoriteRouteStats.length > 0 && activeFavoriteCount === 0 ? (
                    <div className="mt-3 text-xs text-yellow-200/80">{t('noActiveFavoriteRoutes')}</div>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default ControlPanel;