/**
 * Gate analytics derived from real visitor logs (history endpoint rows).
 * Everything is computed in the device's local time, matching what the admin sees.
 */

export interface HourlyArrivalPoint {
  time: string;
  value: number;
}

export interface WeeklyDensityCell {
  day: string;
  hour: number;
  intensity: number;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HEATMAP_HOURS = [0, 4, 8, 12, 16, 18, 20];
const CHART_BUCKET_HOURS = 2;

const pad = (n: number) => String(n).padStart(2, '0');

const CATEGORY_LABELS: Record<string, string> = {
  GUEST: 'Guest',
  ADMIN_GUEST: 'Guest',
  CAB: 'Cab',
  DELIVERY: 'Delivery',
  SERVICE: 'Service',
  WALK_IN: 'Walk-In',
};

const categoryOf = (log: any): string => {
  if (log?.entryType === 'WALK_IN') return CATEGORY_LABELS.WALK_IN;
  const passType = log?.passId?.passType;
  return CATEGORY_LABELS[passType] || 'Other';
};

export const computeGateAnalytics = (logs: any[], now: Date = new Date()) => {
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfToday.getTime() - 6 * 24 * 60 * 60 * 1000);

  const entries = (Array.isArray(logs) ? logs : [])
    .filter((log) => log?.checkInTime)
    .map((log) => ({ log, at: new Date(log.checkInTime) }))
    .filter(({ at }) => !Number.isNaN(at.getTime()));

  const today = entries.filter(({ at }) => at >= startOfToday);
  const thisWeek = entries.filter(({ at }) => at >= startOfWeek);

  // Arrivals per hour today; the chart shows 2-hour buckets, the peak uses single hours.
  const perHour = new Array(24).fill(0);
  today.forEach(({ at }) => {
    perHour[at.getHours()] += 1;
  });
  const hourlyArrivals: HourlyArrivalPoint[] = [];
  for (let h = 0; h < 24; h += CHART_BUCKET_HOURS) {
    hourlyArrivals.push({ time: `${pad(h)}:00`, value: perHour.slice(h, h + CHART_BUCKET_HOURS).reduce((a, b) => a + b, 0) });
  }
  const peakCount = Math.max(...perHour);
  const peakHourIndex = perHour.indexOf(peakCount);
  const peakHour = peakCount > 0 ? `${pad(peakHourIndex)}:00 - ${pad((peakHourIndex + 1) % 24)}:00` : 'No entries yet';

  const categoryCounts = new Map<string, number>();
  thisWeek.forEach(({ log }) => {
    const category = categoryOf(log);
    categoryCounts.set(category, (categoryCounts.get(category) || 0) + 1);
  });
  const categoryDistribution = [...categoryCounts.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count);

  // Heatmap cell = arrivals in [hour, next listed hour) on that weekday, scaled to the busiest cell.
  const densityCounts = new Map<string, number>();
  thisWeek.forEach(({ at }) => {
    const hour = at.getHours();
    const slot = [...HEATMAP_HOURS].reverse().find((h) => hour >= h) ?? 0;
    const key = `${DAY_NAMES[at.getDay()]}|${slot}`;
    densityCounts.set(key, (densityCounts.get(key) || 0) + 1);
  });
  const busiest = Math.max(1, ...densityCounts.values());
  const weeklyDensity: WeeklyDensityCell[] = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].flatMap((day) =>
    HEATMAP_HOURS.map((hour) => ({ day, hour, intensity: (densityCounts.get(`${day}|${hour}`) || 0) / busiest }))
  );

  return {
    totalEntriesToday: today.length,
    hourlyArrivals,
    peakHour,
    categoryDistribution,
    weeklyDensity,
  };
};
