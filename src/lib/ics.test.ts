import { describe, expect, it } from "vitest";
import { parseIcs } from "./ics";

const sample = `BEGIN:VCALENDAR
BEGIN:VEVENT
UID:42@moodle
SUMMARY:Entrega práctica 1
DESCRIPTION:Subir el\\, PDF
CATEGORIES:Bases de Datos
DTSTART:20261110T225900Z
DTEND:20261110T225900Z
END:VEVENT
BEGIN:VEVENT
SUMMARY:sin uid
DTSTART:20261110T225900Z
END:VEVENT
END:VCALENDAR`;

describe("parseIcs", () => {
  it("parses Moodle events with course and UTC date", () => {
    const ev = parseIcs(sample);
    const e0 = ev[0]!;
    expect(ev).toHaveLength(1);
    expect(e0.uid).toBe("42@moodle");
    expect(e0.course).toBe("Bases de Datos");
    expect(e0.description).toBe("Subir el, PDF");
    expect(e0.starts_at).toBe("2026-11-10T22:59:00.000Z");
  });
  it("rejects non-calendar text", () => {
    expect(() => parseIcs("hola")).toThrow();
  });
});
