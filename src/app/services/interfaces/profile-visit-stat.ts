export interface ProfileVisitStat {
  date: string;
  visits: number;
}

export function getVisitDateKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
