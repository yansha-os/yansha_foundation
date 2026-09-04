import { format, parseISO, subDays } from "date-fns";

export function todayKey(): string {
  return format(new Date(), "yyyy-MM-dd");
}

export function keyToDate(key: string): Date {
  return parseISO(key);
}

export function lastNDays(n: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    keys.push(format(subDays(now, i), "yyyy-MM-dd"));
  }
  return keys;
}

export function shortLabel(key: string): string {
  return format(parseISO(key), "EEE");
}
