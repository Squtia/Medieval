export function calendarToTotalDays(year: number, month: number, day: number): number {
  const safeYear = Math.max(1, Math.floor(year));
  const safeMonth = Math.min(12, Math.max(1, Math.floor(month)));
  const safeDay = Math.min(30, Math.max(1, Math.floor(day)));
  return ((safeYear - 1) * 12 + (safeMonth - 1)) * 30 + safeDay;
}
