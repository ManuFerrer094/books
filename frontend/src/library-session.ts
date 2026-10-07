export function readingMinutes(value: number): number {
  return Math.round(
    Math.max(1, Math.min(180, Number.isFinite(value) ? value : 25)),
  );
}
export function remainingTime(deadline: number, now: number): string {
  const seconds = Math.max(0, Math.ceil((deadline - now) / 1000));
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
