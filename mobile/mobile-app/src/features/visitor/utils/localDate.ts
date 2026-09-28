/**
 * YYYY-MM-DD for the device's local calendar day.
 * toISOString() gives the UTC day, which is still "yesterday" in IST before 05:30.
 */
export const toLocalDateKey = (date: Date = new Date()): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};
