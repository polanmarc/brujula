// Minimal iCalendar (RFC 5545) VEVENT parser — enough for Moodle exports.
export type IcsEvent = {
  uid: string;
  title: string;
  description: string | null;
  course: string | null;
  starts_at: string;
  ends_at: string | null;
  url: string | null;
};

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function unescape(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\,/g, ",").replace(/\\;/g, ";").replace(/\\\\/g, "\\").trim();
}

export function parseIcsDate(value: string, params: string): string | null {
  const v = value.trim();
  const m = v.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y = "", mo = "", d = "", h = "00", mi = "00", s = "00", z] = m;
  if (z || !params.includes("TZID")) {
    // UTC or floating/date-only → treat as UTC
    return new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s)).toISOString();
  }
  // TZID given: Moodle uses the user's timezone; interpret as Europe/Madrid-like local by offset lookup
  const tz = params.match(/TZID=([^;:]+)/)?.[1] ?? "UTC";
  const asUtc = Date.UTC(+y, +mo - 1, +d, +h, +mi, +s);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = new Map(fmt.formatToParts(new Date(asUtc)).map((p) => [p.type, Number(p.value)]));
    const g = (k: Intl.DateTimeFormatPartTypes) => parts.get(k) ?? 0;
    const tzAsUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second"));
    return new Date(asUtc - (tzAsUtc - asUtc)).toISOString();
  } catch {
    return new Date(asUtc).toISOString();
  }
}

export function parseIcs(text: string): IcsEvent[] {
  if (!text.includes("BEGIN:VCALENDAR")) throw new Error("El archivo no es un calendario iCal válido");
  const out: IcsEvent[] = [];
  let map: Map<string, { value: string; params: string }> | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") { map = new Map(); continue; }
    if (line === "END:VEVENT") {
      if (map) {
        const m = map;
        const cur = { DTSTART: m.get("DTSTART"), DTEND: m.get("DTEND"), UID: m.get("UID"), SUMMARY: m.get("SUMMARY"), DESCRIPTION: m.get("DESCRIPTION"), CATEGORIES: m.get("CATEGORIES"), URL: m.get("URL") };
        const start = cur.DTSTART ? parseIcsDate(cur.DTSTART.value, cur.DTSTART.params) : null;
        const uid = cur.UID?.value.trim();
        if (start && uid) {
          const end = cur.DTEND ? parseIcsDate(cur.DTEND.value, cur.DTEND.params) : null;
          out.push({
            uid,
            title: unescape(cur.SUMMARY?.value ?? "Sin título"),
            description: cur.DESCRIPTION ? unescape(cur.DESCRIPTION.value) || null : null,
            course: cur.CATEGORIES ? unescape(cur.CATEGORIES.value) || null : null,
            starts_at: start,
            ends_at: end,
            url: cur.URL ? cur.URL.value.trim() : null,
          });
        }
      }
      map = null;
      continue;
    }
    if (!map) continue;
    const idx = line.indexOf(":");
    if (idx < 0) continue;
    const head = line.slice(0, idx);
    const [name, ...rest] = head.split(";");
    map.set((name ?? "").toUpperCase(), { value: line.slice(idx + 1), params: rest.join(";") });
  }
  return out;
}
