const CLUB_TIME_ZONE = process.env.NEXT_PUBLIC_CLUB_TIMEZONE || "America/New_York";

/** UTC offset of the club timezone at a given instant, in whole minutes. */
function offsetMinutes(instant: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: CLUB_TIME_ZONE,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(instant);
  const num = (type: string) => {
    const raw = Number(parts.find((p) => p.type === type)?.value ?? "0");
    return type === "hour" ? raw % 24 : raw;
  };
  const wallClockAsUtc = Date.UTC(num("year"), num("month") - 1, num("day"), num("hour"), num("minute"), num("second"));
  return Math.round((wallClockAsUtc - instant.getTime()) / 60000);
}

/**
 * `<input type="datetime-local">` yields a wall clock string with no zone. The
 * server's zone is not the club's zone, so interpret it in club time explicitly.
 */
export function clubLocalToIso(naive: string): string {
  const [datePart, timePart = "00:00"] = naive.split("T");
  const [y, m, d] = datePart.split("-").map(Number);
  const [hh, mm] = timePart.split(":").map(Number);
  if (!y || !m || !d || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error(`Unparsable date/time: "${naive}"`);
  }

  const wallAsUtc = Date.UTC(y, m - 1, d, hh, mm);
  let iso = wallAsUtc - offsetMinutes(new Date(wallAsUtc)) * 60000;

  // Around a DST change the offset before and after the shift can differ, so resolve once more.
  const second = offsetMinutes(new Date(iso));
  const first = offsetMinutes(new Date(wallAsUtc));
  if (second !== first) iso = wallAsUtc - second * 60000;

  return new Date(iso).toISOString();
}

export { CLUB_TIME_ZONE };
