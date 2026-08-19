export const SINGAPORE_TIME_ZONE = "Asia/Singapore";

// Singapore has no DST, so calendar-day arithmetic of 86_400_000 ms is exact.
const MS_PER_DAY = 86_400_000;
const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function singaporeDateKey(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SINGAPORE_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function singaporeMidnight(dateKey: string): Date {
  if (!DATE_KEY_PATTERN.test(dateKey)) {
    throw new Error(`Invalid Singapore date key: ${dateKey}`);
  }

  const date = new Date(`${dateKey}T00:00:00+08:00`);
  if (Number.isNaN(date.getTime()) || singaporeDateKey(date) !== dateKey) {
    throw new Error(`Invalid Singapore date key: ${dateKey}`);
  }

  return date;
}

export function toSingaporeMidnight(date: Date): Date {
  return singaporeMidnight(singaporeDateKey(date));
}

export function singaporeCalendarDaysBetween(from: Date, to: Date): number {
  const fromMs = singaporeMidnight(singaporeDateKey(from)).getTime();
  const toMs = singaporeMidnight(singaporeDateKey(to)).getTime();
  return Math.round((toMs - fromMs) / MS_PER_DAY);
}

export function formatSingaporeDate(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString("en-US", {
    ...options,
    timeZone: SINGAPORE_TIME_ZONE,
  });
}

export function formatEventDate(date: Date): string {
  return formatSingaporeDate(date, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateDDMMYYYY(date: Date): string {
  const [year, month, day] = singaporeDateKey(date).split("-");
  return `${day}/${month}/${year}`;
}

export function parseDateDDMMYYYY(value: string): Date | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;

  const [, day, month, year] = match;
  try {
    return singaporeMidnight(`${year}-${month}-${day}`);
  } catch {
    return null;
  }
}

export function getDaysAgoLabel(date: Date, now = new Date()): string {
  const diffDays = singaporeCalendarDaysBetween(date, now);

  if (diffDays === 0) return "today";
  if (diffDays === 1) return "1 day ago";
  if (diffDays === -1) return "in 1 day";
  if (diffDays < 0) return `in ${Math.abs(diffDays)} days`;
  return `${diffDays} days ago`;
}

export function isPastEventDay(eventDate: Date, now = new Date()): boolean {
  return singaporeDateKey(now) > singaporeDateKey(eventDate);
}

export function singaporeWeekday(date: Date): number {
  return new Date(`${singaporeDateKey(date)}T00:00:00Z`).getUTCDay();
}

export function addSingaporeDays(date: Date, days: number): Date {
  return new Date(toSingaporeMidnight(date).getTime() + days * MS_PER_DAY);
}

export function endOfSingaporeDay(date: Date): Date {
  return new Date(`${singaporeDateKey(date)}T23:59:59.999+08:00`);
}
