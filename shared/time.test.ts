import { describe, expect, test } from "vitest";
import { formatInspectionDay, formatPacific } from "./time";

describe("display times", () => {
  test("formats an instant in Pacific Time and labels it PT", () => {
    expect(formatPacific(Date.UTC(2026, 9, 26, 13, 0))).toBe(
      "Oct 26, 2026, 6:00 AM PT",
    );
  });

  test("formats inspection dates as calendar dates", () => {
    expect(formatInspectionDay("2026-10-23")).toBe("Oct 23, 2026");
    expect(formatInspectionDay("2026-10-23T00:00:00.000")).toBe("Oct 23, 2026");
  });
});
