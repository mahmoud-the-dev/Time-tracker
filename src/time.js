export function getWeekRange(now = Date.now()) {
  const date = new Date(now);
  const day = date.getDay();
  const diffToMonday = (day + 6) % 7;
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate() - diffToMonday);
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 7);
  return { start: start.getTime(), end: end.getTime() };
}

export function getMonthRange(monthTimestamp = Date.now()) {
  const date = new Date(monthTimestamp);
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return { start: start.getTime(), end: end.getTime() };
}

export function clampPeriodOverlap(start, end, periodStart, periodEnd) {
  const overlapStart = Math.max(start, periodStart);
  const overlapEnd = Math.min(end, periodEnd);
  return Math.max(0, overlapEnd - overlapStart);
}

export function sumBreakDuration(breaks, fallbackEnd = Date.now(), range = null) {
  return breaks.reduce((total, item) => {
    const end = item.endedAt || fallbackEnd;
    if (end <= item.startedAt) return total;
    if (range) return total + clampPeriodOverlap(item.startedAt, end, range.start, range.end);
    return total + (end - item.startedAt);
  }, 0);
}

export function sumStudyDuration(session, breaks, fallbackEnd = Date.now(), range = null) {
  const sessionEnd = session.endedAt || fallbackEnd;
  const elapsed = range
    ? clampPeriodOverlap(session.startedAt, sessionEnd, range.start, range.end)
    : Math.max(0, sessionEnd - session.startedAt);
  const breakMs = sumBreakDuration(breaks, fallbackEnd, range);
  return Math.max(0, elapsed - breakMs);
}

export function formatDuration(ms, options = {}) {
  const safeMs = Math.max(0, ms || 0);
  const totalSeconds = Math.floor(safeMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (options.live) {
    return `${hours}h ${String(minutes).padStart(2, '0')}m ${String(seconds).padStart(2, '0')}s`;
  }
  return `${hours}h ${String(minutes).padStart(2, '0')}m`;
}

export function formatDateTime(timestamp) {
  if (!timestamp) return 'Open';
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp));
}

export function formatMonthLabel(timestamp) {
  return new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(new Date(timestamp));
}

export function formatInputDateTime(timestamp) {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export function parseInputDateTime(value) {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) throw new Error('Enter a valid date and time.');
  return timestamp;
}
