const numbers: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
  twelve: 12,
};
/** Resolves only explicit relative durations. Ambiguous clock times stay user-reported. */
export function resolveReportedTime(timeText: string | null, now: Date) {
  if (!timeText) return { occurred_at: null, approximate: false };
  const match =
    /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|twelve)\s+(minute|hour|day)s?\s+ago\b/i.exec(
      timeText,
    );
  if (!match) return { occurred_at: null, approximate: true };
  const n = numbers[match[1].toLowerCase()] || Number(match[1]);
  if (!Number.isFinite(n) || n > 365)
    return { occurred_at: null, approximate: true };
  const unit =
    match[2].toLowerCase() === "minute"
      ? 60000
      : match[2].toLowerCase() === "hour"
        ? 3600000
        : 86400000;
  return {
    occurred_at: new Date(now.getTime() - n * unit).toISOString(),
    approximate: /around|about|roughly/i.test(timeText),
  };
}
